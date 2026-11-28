import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { OptionalUuidArg, UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { QaService } from '../../application/qa.service.js';
import { AddQaPlanCasesInput, QaCaseGql, QaCoverageGql, QaPlanCaseGql, QaPlanGql, QaReadinessGql, QaRunGql, QaSuiteGql, RecordQaRunInput, SaveQaCaseInput, SaveQaPlanInput } from './qa.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/** E6.4 QA: reading needs task.view, changing task.update (in the project), approving space.manage. */
@Resolver(() => QaCaseGql)
export class QaResolver {
  constructor(private readonly service: QaService) {}

  @Query(() => [QaSuiteGql])
  @RequirePermissions('task.view')
  qaSuites(@WorkspaceIdArg() _w: string, @UuidArg('spaceId') spaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<QaSuiteGql[]> {
    return this.service.listSuites(access, spaceId);
  }

  @Mutation(() => QaSuiteGql)
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(60))
  saveQaSuite(
    @WorkspaceIdArg() _w: string,
    @UuidArg('spaceId') spaceId: string,
    @OptionalUuidArg('suiteId') suiteId: string | null,
    @Args('name') name: string,
    @Args('description', { type: () => String, nullable: true }) description: string | null,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<QaSuiteGql> {
    return this.service.saveSuite(access, spaceId, suiteId, name, description);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.update')
  deleteQaSuite(@WorkspaceIdArg() _w: string, @UuidArg('suiteId') suiteId: string, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.deleteSuite(access, suiteId);
  }

  @Query(() => [QaCaseGql])
  @RequirePermissions('task.view')
  qaCases(
    @WorkspaceIdArg() _w: string,
    @UuidArg('spaceId') spaceId: string,
    @OptionalUuidArg('suiteId') suiteId: string | null,
    @Args('status', { type: () => String, nullable: true }) status: string | null,
    @Args('search', { type: () => String, nullable: true }) search: string | null,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<QaCaseGql[]> {
    return this.service.listCases(access, spaceId, { suiteId, status, search: search?.slice(0, 100) ?? null });
  }

  @Query(() => QaCaseGql)
  @RequirePermissions('task.view')
  qaCase(@WorkspaceIdArg() _w: string, @UuidArg('caseId') caseId: string, @CurrentAccess() access: WorkspaceAccess): Promise<QaCaseGql> {
    return this.service.getCase(access, caseId);
  }

  @Query(() => [QaRunGql], { description: 'Every run of a case, newest first' })
  @RequirePermissions('task.view')
  qaCaseRuns(@WorkspaceIdArg() _w: string, @UuidArg('caseId') caseId: string, @CurrentAccess() access: WorkspaceAccess): Promise<QaRunGql[]> {
    return this.service.caseRuns(access, caseId);
  }

  @Mutation(() => QaCaseGql, { description: 'Creates (no caseId) or updates a test case' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(60))
  saveQaCase(
    @WorkspaceIdArg() _w: string,
    @UuidArg('spaceId') spaceId: string,
    @OptionalUuidArg('caseId') caseId: string | null,
    @Args('input') input: SaveQaCaseInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<QaCaseGql> {
    return this.service.saveCase(actor, access, spaceId, caseId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.update')
  deleteQaCase(@WorkspaceIdArg() _w: string, @UuidArg('caseId') caseId: string, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.deleteCase(access, caseId);
  }

  @Query(() => [QaPlanGql])
  @RequirePermissions('task.view')
  qaPlans(@WorkspaceIdArg() _w: string, @UuidArg('spaceId') spaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<QaPlanGql[]> {
    return this.service.listPlans(access, spaceId);
  }

  @Query(() => QaPlanGql)
  @RequirePermissions('task.view')
  qaPlan(@WorkspaceIdArg() _w: string, @UuidArg('planId') planId: string, @CurrentAccess() access: WorkspaceAccess): Promise<QaPlanGql> {
    return this.service.getPlan(access, planId);
  }

  @Query(() => [QaPlanCaseGql], { description: 'The cases in a plan with their current result' })
  @RequirePermissions('task.view')
  qaPlanCases(@WorkspaceIdArg() _w: string, @UuidArg('planId') planId: string, @CurrentAccess() access: WorkspaceAccess): Promise<QaPlanCaseGql[]> {
    return this.service.planCases(access, planId);
  }

  @Mutation(() => QaPlanGql, { description: 'Creates (no planId) or updates a test plan' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(30))
  saveQaPlan(
    @WorkspaceIdArg() _w: string,
    @UuidArg('spaceId') spaceId: string,
    @OptionalUuidArg('planId') planId: string | null,
    @Args('input') input: SaveQaPlanInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<QaPlanGql> {
    return this.service.savePlan(actor, access, spaceId, planId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.update')
  deleteQaPlan(@WorkspaceIdArg() _w: string, @UuidArg('planId') planId: string, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.deletePlan(access, planId);
  }

  @Mutation(() => Int, { description: 'Adds cases to a plan; returns how many were new' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(30))
  addQaPlanCases(@WorkspaceIdArg() _w: string, @UuidArg('planId') planId: string, @Args('input') input: AddQaPlanCasesInput, @CurrentAccess() access: WorkspaceAccess): Promise<number> {
    return this.service.addCasesToPlan(access, planId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.update')
  removeQaPlanCase(@WorkspaceIdArg() _w: string, @UuidArg('planId') planId: string, @UuidArg('caseId') caseId: string, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.removeCaseFromPlan(access, planId, caseId);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('task.update')
  assignQaPlanCase(
    @WorkspaceIdArg() _w: string,
    @UuidArg('planId') planId: string,
    @UuidArg('caseId') caseId: string,
    @Args('assigneeId', { type: () => String, nullable: true }) assigneeId: string | null,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    return this.service.assignCase(access, planId, caseId, assigneeId);
  }

  @Mutation(() => QaPlanCaseGql, { description: 'Records a result; a failure files a bug, a passing retest verifies it' })
  @RequirePermissions('task.update')
  @Throttle(PER_MINUTE(120))
  recordQaRun(@WorkspaceIdArg() _w: string, @Args('input') input: RecordQaRunInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<QaPlanCaseGql> {
    return this.service.recordRun(actor, access, input);
  }

  @Mutation(() => QaPlanGql, { description: 'QA sign-off: approve or reject a plan (or reopen it)' })
  @RequirePermissions('space.manage')
  @Throttle(PER_MINUTE(20))
  decideQaPlan(
    @WorkspaceIdArg() _w: string,
    @UuidArg('planId') planId: string,
    @Args('decision') decision: string,
    @Args('note', { type: () => String, nullable: true }) note: string | null,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<QaPlanGql> {
    if (decision !== 'approved' && decision !== 'rejected' && decision !== 'open') throw DomainError.invalid('Approve, reject or reopen');
    return this.service.decide(actor, access, planId, decision, note);
  }

  @Query(() => QaReadinessGql, { description: 'Release readiness of a plan' })
  @RequirePermissions('task.view')
  qaReadiness(@WorkspaceIdArg() _w: string, @UuidArg('planId') planId: string, @CurrentAccess() access: WorkspaceAccess): Promise<QaReadinessGql> {
    return this.service.readiness(access, planId);
  }

  @Query(() => QaCoverageGql, { description: 'How much of the project the test cases cover' })
  @RequirePermissions('task.view')
  qaCoverage(@WorkspaceIdArg() _w: string, @UuidArg('spaceId') spaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<QaCoverageGql> {
    return this.service.coverage(access, spaceId);
  }
}
