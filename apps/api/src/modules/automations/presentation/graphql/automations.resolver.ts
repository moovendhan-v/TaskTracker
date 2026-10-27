import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { AutomationsService } from '../../application/automations.service.js';
import { AutomationRuleGql, AutomationRunGql, SaveAutomationInput } from './automation.types.js';

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
    return this.automationsService.create(actor, access, spaceId, input);
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
    return this.automationsService.update(actor, access, ruleId, input);
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
}
