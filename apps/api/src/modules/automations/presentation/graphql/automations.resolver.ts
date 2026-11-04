import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { AutomationFlow, SaveAutomationRequest } from '@taskflow/shared-types';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { AutomationsService } from '../../application/automations.service.js';
import { Throttle } from '@nestjs/throttler';
import { AutomationRuleGql, AutomationRunGql, AutomationRunStepGql, SaveAutomationInput } from './automation.types.js';

@Resolver(() => AutomationRuleGql)
export class AutomationsResolver {
  constructor(private readonly automationsService: AutomationsService) {}

  @Query(() => [AutomationRuleGql], { description: 'A space’s automations' })
  @RequirePermissions('task.view')
  automations(@WorkspaceIdArg() _workspaceId: string, @UuidArg('spaceId') spaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<AutomationRuleGql[]> {
    return this.automationsService.listInSpace(access.workspaceId, spaceId);
  }

  @Query(() => [AutomationRunGql], { description: 'Recent runs of one automation, newest first' })
  @RequirePermissions('automation.manage')
  automationRuns(@WorkspaceIdArg() _workspaceId: string, @UuidArg('ruleId') ruleId: string, @CurrentAccess() access: WorkspaceAccess): Promise<AutomationRunGql[]> {
    return this.automationsService.runs(access.workspaceId, ruleId);
  }

  @Mutation(() => AutomationRuleGql)
  @RequirePermissions('automation.manage')
  createAutomation(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('input') input: SaveAutomationInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AutomationRuleGql> {
    return this.automationsService.create(actor, access, spaceId, withFlow(input));
  }

  @Mutation(() => AutomationRuleGql, { description: 'Saving takes the rule over: it then runs as you' })
  @RequirePermissions('automation.manage')
  updateAutomation(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('ruleId') ruleId: string,
    @Args('input') input: SaveAutomationInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AutomationRuleGql> {
    return this.automationsService.update(actor, access, ruleId, withFlow(input));
  }

  @Mutation(() => AutomationRuleGql)
  @RequirePermissions('automation.manage')
  setAutomationEnabled(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('ruleId') ruleId: string,
    @Args('enabled') enabled: boolean,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AutomationRuleGql> {
    return this.automationsService.setEnabled(actor, access, ruleId, enabled);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('automation.manage')
  async deleteAutomation(@WorkspaceIdArg() _workspaceId: string, @UuidArg('ruleId') ruleId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.automationsService.remove(actor, access, ruleId);
    return true;
  }

  @Query(() => [AutomationRunStepGql], { description: 'A test run: the path a flow would take for one task of the space. Changes nothing' })
  @RequirePermissions('automation.manage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  previewAutomation(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @UuidArg('taskId') taskId: string,
    @Args('input') input: SaveAutomationInput,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<AutomationRunStepGql[]> {
    return this.automationsService.preview(access, spaceId, withFlow(input), taskId);
  }

  @Mutation(() => String, { description: 'The secret this automation signs webhook calls with. Audited; rotate makes a new one' })
  @RequirePermissions('automation.manage')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  revealAutomationWebhookSecret(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('ruleId') ruleId: string,
    @Args('rotate', { defaultValue: false }) rotate: boolean,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<string> {
    return this.automationsService.revealWebhookSecret(actor, access, ruleId, rotate);
  }

  @ResolveField(() => String, { nullable: true, description: 'The rule\'s steps as a tree (JSON); null for a rule saved before flows' })
  flowJson(@Parent() rule: AutomationRuleGql): string | null {
    return rule.flow ? JSON.stringify(rule.flow) : null;
  }
}

/** The flow arrives as JSON text; it is parsed here and fully checked by the service. */
function withFlow(input: SaveAutomationInput): SaveAutomationRequest {
  const { flowJson, ...rest } = input;
  if (!flowJson) return { ...rest, flow: null };
  try {
    return { ...rest, flow: JSON.parse(flowJson) as AutomationFlow };
  } catch {
    throw DomainError.invalid('The flow is not valid JSON');
  }
}
