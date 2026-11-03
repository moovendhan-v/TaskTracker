import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  AUTOMATION_LIMITS,
  flowActions,
  flowFromRule,
  canInSpace,
  simulateFlow,
  type AutomationRuleResponse,
  type AutomationRunResponse,
  type FlowTraceEntry,
  type SaveAutomationRequest,
} from '@taskflow/shared-types';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { AuditLogger } from '../../../core/audit/audit-logger.port.js';
import { SecretBox } from '../../../core/crypto/secret-box.js';
import { parseAllowedHosts, webhookUrlProblem, type WebhookPolicy } from '../../../core/net/outbound-webhook.js';
import { Clock } from '../../../core/time/clock.port.js';
import { ChatService } from '../../chat/application/chat.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
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
    private readonly chatService: ChatService,
    private readonly tasksService: TasksService,
    private readonly secretBox: SecretBox,
    private readonly auditLogger: AuditLogger,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** The server's webhook rules (allowlist from AUTOMATION_WEBHOOK_HOSTS). */
  webhookPolicy(): WebhookPolicy {
    return { allowedHosts: parseAllowedHosts(this.env.AUTOMATION_WEBHOOK_HOSTS), insecureForTests: this.env.AUTOMATION_WEBHOOK_INSECURE_FOR_TESTS };
  }

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
    const parts = await this.validate(actor, access, spaceId, request);
    const rule = await this.automations.create({
      workspaceId: access.workspaceId,
      spaceId,
      name: request.name.trim(),
      enabled: request.enabled ?? true,
      ...parts,
      createdById: actor.userId,
    });
    await this.ensureWebhookSecret(rule);
    return AutomationMapper.toResponse(rule);
  }

  /** Saving takes the rule over: from now on it runs as the person who saved it. */
  @Audited('automation.update', change)
  @Announces('automation.updated', workspaceFromAccess)
  async update(actor: Actor, access: WorkspaceAccess, ruleId: string, request: SaveAutomationRequest): Promise<AutomationRuleResponse> {
    const rule = await this.getInWorkspace(access.workspaceId, ruleId);
    SpaceGuard.assert(rule.spaceId, 'automation.manage');
    const parts = await this.validate(actor, access, rule.spaceId, request);
    const saved = await this.automations.save({ ...rule, ...parts, name: request.name.trim(), enabled: request.enabled ?? rule.enabled, createdById: actor.userId });
    await this.ensureWebhookSecret(saved);
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

  /**
   * The secret a rule's webhook calls are signed with, for setting up the receiver.
   * Needs automation.manage in the rule's space, and every reveal is audited.
   * `rotate` makes a new one (the old one stops verifying at once).
   */
  async revealWebhookSecret(actor: Actor, access: WorkspaceAccess, ruleId: string, rotate: boolean): Promise<string> {
    const rule = await this.getInWorkspace(access.workspaceId, ruleId);
    SpaceGuard.assert(rule.spaceId, 'automation.manage');
    let secret = rule.webhookSecretSealed && !rotate ? this.secretBox.open(rule.webhookSecretSealed) : null;
    if (!secret) {
      secret = randomBytes(32).toString('base64url');
      await this.automations.saveWebhookSecret(access.workspaceId, rule.id, this.secretBox.seal(secret));
    }
    await this.auditLogger.record(actor, {
      action: rotate ? 'automation.webhook_secret.rotate' : 'automation.webhook_secret.reveal',
      targetType: 'automation',
      targetId: rule.id,
      workspaceId: access.workspaceId,
      metadata: { name: rule.name, spaceId: rule.spaceId },
    });
    return secret;
  }

  /**
   * A test run: walks a flow (saved or not) against one task of the space and
   * says which path it would take. Nothing is changed.
   */
  async preview(access: WorkspaceAccess, spaceId: string, request: Pick<SaveAutomationRequest, 'conditions' | 'actions' | 'flow'>, taskId: string): Promise<FlowTraceEntry[]> {
    await this.spacesService.getInWorkspace(access.workspaceId, spaceId);
    SpaceGuard.assert(spaceId, 'automation.manage');
    const flow = request.flow ? AutomationPolicy.normalizeFlow(request.flow) : flowFromRule(AutomationPolicy.normalizeConditions(request.conditions), AutomationPolicy.normalizeActions(request.actions));
    const task = await this.tasksService.get(access.workspaceId, taskId);
    if (task.spaceId !== spaceId) throw DomainError.notFound('Task');
    const categories = new Map((await this.statusesService.listForSpace(access.workspaceId, spaceId)).map((status) => [status.id, status.category]));
    const facts = {
      listId: task.listId,
      statusId: task.statusId,
      statusCategory: task.status.category,
      priority: task.priority,
      type: task.type,
      title: task.title,
      assigneeIds: task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [],
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : null,
    };
    return simulateFlow(flow, facts, this.clock.now().toISOString().slice(0, 10), { statusCategoryOf: (statusId) => categories.get(statusId) });
  }

  /** Rules that call webhooks get a signing secret when first saved. */
  private async ensureWebhookSecret(rule: AutomationRule): Promise<void> {
    if (rule.webhookSecretSealed || !rule.actions.some((action) => action.type === 'webhook')) return;
    await this.automations.saveWebhookSecret(rule.workspaceId, rule.id, this.secretBox.seal(randomBytes(32).toString('base64url')));
  }

  private async validate(actor: Actor, access: WorkspaceAccess, spaceId: string, request: SaveAutomationRequest): Promise<Pick<AutomationRule, 'triggerType' | 'trigger' | 'conditions' | 'actions' | 'flow'>> {
    const trigger = AutomationPolicy.normalizeTrigger(request.trigger);
    // With a flow, the flow decides what runs; its actions are also kept flat for older readers.
    const flow = request.flow ? AutomationPolicy.normalizeFlow(request.flow) : null;
    const conditions = flow ? AutomationPolicy.normalizeConditions(undefined) : AutomationPolicy.normalizeConditions(request.conditions);
    const actions = flow ? flowActions(flow) : AutomationPolicy.normalizeActions(request.actions);

    const missing = AutomationPolicy.requiredPermissions(actions).filter((permission) => !canInSpace(access, spaceId, permission));
    if (missing.length) throw DomainError.forbidden(`These actions need ${missing.join(', ')} in this space, which you don’t have`);

    const flat = AutomationPolicy.referencedIds(trigger, conditions, actions);
    const inFlow = flow ? AutomationPolicy.flowConditionIds(flow) : { statusIds: [], listIds: [], userIds: [] };
    const ids = { statusIds: [...flat.statusIds, ...inFlow.statusIds], listIds: [...flat.listIds, ...inFlow.listIds], userIds: [...flat.userIds, ...inFlow.userIds] };
    const statusIds = new Set((await this.statusesService.listForSpace(access.workspaceId, spaceId)).map((status) => status.id));
    if (ids.statusIds.some((id) => !statusIds.has(id))) throw DomainError.invalid('Use statuses of this space');
    const listIds = new Set((await this.listsService.listForWorkspace(access.workspaceId)).filter((list) => list.spaceId === spaceId).map((list) => list.id));
    if (ids.listIds.some((id) => !listIds.has(id))) throw DomainError.invalid('Use lists of this space');
    for (const userId of new Set(ids.userIds)) {
      if (!(await this.membersService.isMember(access.workspaceId, userId))) throw DomainError.invalid('Only members of the workspace can be assigned or notified');
    }
    // The rule posts as you, so you must be able to post there now.
    for (const channelId of AutomationPolicy.channelIds(actions)) await this.chatService.assertCanPost(actor, access, channelId);
    const policy = this.webhookPolicy();
    for (const action of actions) {
      const problem = action.type === 'webhook' ? webhookUrlProblem(action.url ?? '', policy) : null;
      if (problem) throw DomainError.invalid(problem);
    }
    return { triggerType: trigger.type, trigger, conditions, actions, flow };
  }

  private async getInWorkspace(workspaceId: string, ruleId: string): Promise<AutomationRule> {
    return found(await this.automations.findInWorkspace(workspaceId, ruleId), 'Automation');
  }
}
