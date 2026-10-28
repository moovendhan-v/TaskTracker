import { Injectable } from '@nestjs/common';
import { AUTOMATION_LIMITS, canInSpace, type AutomationRuleResponse, type AutomationRunResponse, type SaveAutomationRequest } from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { workspaceFromAccess } from '../../../core/runtime/change-target.js';
import { ListsService } from '../../lists/application/lists.service.js';
import { MembersService } from '../../members/application/members.service.js';
import { SpacesService } from '../../spaces/application/spaces.service.js';
import { StatusesService } from '../../statuses/application/statuses.service.js';
import type { AutomationRule } from '../domain/automation-rule.js';
import { AutomationPolicy } from '../domain/automation.policy.js';
import { AutomationRepository } from '../domain/automation.repository.js';
import { AutomationMapper } from './automation.mapper.js';

const RUNS_SHOWN = 50;

const change = { ...workspaceFromAccess, targetType: 'automation', metadata: (rule: AutomationRuleResponse) => ({ name: rule.name, spaceId: rule.spaceId, trigger: rule.trigger.type }) };

/**
 * Automation rules of a space. A rule runs as the person who last saved it, so
 * saving checks that they may do everything its actions do in that space.
 */
@Injectable()
export class AutomationsService {
  constructor(
    private readonly automations: AutomationRepository,
    private readonly spacesService: SpacesService,
    private readonly statusesService: StatusesService,
    private readonly listsService: ListsService,
    private readonly membersService: MembersService,
  ) {}

  async listInSpace(workspaceId: string, spaceId: string): Promise<AutomationRuleResponse[]> {
    await this.spacesService.getInWorkspace(workspaceId, spaceId);
    return (await this.automations.listInSpace(workspaceId, spaceId)).map(AutomationMapper.toResponse);
  }

  async runs(workspaceId: string, ruleId: string): Promise<AutomationRunResponse[]> {
    await this.getInWorkspace(workspaceId, ruleId);
    return (await this.automations.listRuns(workspaceId, ruleId, RUNS_SHOWN)).map(AutomationMapper.toRunResponse);
  }

  @Audited('automation.create', change)
  @Announces('automation.created', workspaceFromAccess)
  async create(actor: Actor, access: WorkspaceAccess, spaceId: string, request: SaveAutomationRequest): Promise<AutomationRuleResponse> {
    await this.spacesService.getInWorkspace(access.workspaceId, spaceId);
    SpaceGuard.assert(spaceId, 'automation.manage');
    if ((await this.automations.countInSpace(access.workspaceId, spaceId)) >= AUTOMATION_LIMITS.rulesPerSpace) {
      throw DomainError.invalid(`A space can have at most ${AUTOMATION_LIMITS.rulesPerSpace} automations`);
    }
    const parts = await this.validate(access, spaceId, request);
    const rule = await this.automations.create({
      workspaceId: access.workspaceId,
      spaceId,
      name: request.name.trim(),
      enabled: request.enabled ?? true,
      ...parts,
      createdById: actor.userId,
    });
    return AutomationMapper.toResponse(rule);
  }

  /** Saving takes the rule over: from now on it runs as the person who saved it. */
  @Audited('automation.update', change)
  @Announces('automation.updated', workspaceFromAccess)
  async update(actor: Actor, access: WorkspaceAccess, ruleId: string, request: SaveAutomationRequest): Promise<AutomationRuleResponse> {
    const rule = await this.getInWorkspace(access.workspaceId, ruleId);
    SpaceGuard.assert(rule.spaceId, 'automation.manage');
    const parts = await this.validate(access, rule.spaceId, request);
    const saved = await this.automations.save({ ...rule, ...parts, name: request.name.trim(), enabled: request.enabled ?? rule.enabled, createdById: actor.userId });
    return AutomationMapper.toResponse(saved);
  }

  @Audited('automation.toggle', change)
  @Announces('automation.updated', workspaceFromAccess)
  async setEnabled(_actor: Actor, access: WorkspaceAccess, ruleId: string, enabled: boolean): Promise<AutomationRuleResponse> {
    const rule = await this.getInWorkspace(access.workspaceId, ruleId);
    SpaceGuard.assert(rule.spaceId, 'automation.manage');
    return AutomationMapper.toResponse(await this.automations.save({ ...rule, enabled }));
  }

  @Audited('automation.delete', change)
  @Announces('automation.deleted', workspaceFromAccess)
  async remove(_actor: Actor, access: WorkspaceAccess, ruleId: string): Promise<AutomationRuleResponse> {
    const rule = await this.getInWorkspace(access.workspaceId, ruleId);
    SpaceGuard.assert(rule.spaceId, 'automation.manage');
    await this.automations.delete(access.workspaceId, ruleId);
    return AutomationMapper.toResponse(rule);
  }

  private async validate(access: WorkspaceAccess, spaceId: string, request: SaveAutomationRequest): Promise<Pick<AutomationRule, 'triggerType' | 'trigger' | 'conditions' | 'actions'>> {
    const trigger = AutomationPolicy.normalizeTrigger(request.trigger);
    const conditions = AutomationPolicy.normalizeConditions(request.conditions);
    const actions = AutomationPolicy.normalizeActions(request.actions);

    const missing = AutomationPolicy.requiredPermissions(actions).filter((permission) => !canInSpace(access, spaceId, permission));
    if (missing.length) throw DomainError.forbidden(`These actions need ${missing.join(', ')} in this space, which you don’t have`);

    const ids = AutomationPolicy.referencedIds(trigger, conditions, actions);
    const statusIds = new Set((await this.statusesService.listForSpace(access.workspaceId, spaceId)).map((status) => status.id));
    if (ids.statusIds.some((id) => !statusIds.has(id))) throw DomainError.invalid('Use statuses of this space');
    const listIds = new Set((await this.listsService.listForWorkspace(access.workspaceId)).filter((list) => list.spaceId === spaceId).map((list) => list.id));
    if (ids.listIds.some((id) => !listIds.has(id))) throw DomainError.invalid('Use lists of this space');
    for (const userId of new Set(ids.userIds)) {
      if (!(await this.membersService.isMember(access.workspaceId, userId))) throw DomainError.invalid('Only members of the workspace can be assigned or notified');
    }
    return { triggerType: trigger.type, trigger, conditions, actions };
  }

  private async getInWorkspace(workspaceId: string, ruleId: string): Promise<AutomationRule> {
    return found(await this.automations.findInWorkspace(workspaceId, ruleId), 'Automation');
  }
}
