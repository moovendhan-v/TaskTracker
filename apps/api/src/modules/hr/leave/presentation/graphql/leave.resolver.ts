import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../../core/graphql/args.js';
import { cappedListComplexity, pagedComplexity } from '../../../../../core/graphql/page.type.js';
import { CurrentActor } from '../../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../../../core/time/clock.port.js';
import { LeaveRequestsService } from '../../application/leave-requests.service.js';
import { LeaveTypesService } from '../../application/leave-types.service.js';
import {
  CreateLeaveTypeInput,
  DecideLeaveInput,
  LeaveBalanceGql,
  LeaveQueueArgs,
  LeaveRequestGql,
  LeaveRequestPageGql,
  LeaveTypeGql,
  RequestLeaveInput,
  UpdateLeaveTypeInput,
} from './leave.types.js';

const MY_REQUESTS_LIMIT = 100;

/** Time off: leave requests, decisions and balances. Decisions take row locks on the balance. */
@Resolver()
export class LeaveResolver {
  constructor(
    private readonly leaveTypesService: LeaveTypesService,
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly clock: Clock,
  ) {}

  @Query(() => [LeaveTypeGql])
  @RequirePermissions()
  leaveTypes(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<LeaveTypeGql[]> {
    return this.leaveTypesService.list(access.workspaceId);
  }

  @Mutation(() => LeaveTypeGql)
  @RequirePermissions('hr.manage')
  createLeaveType(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: CreateLeaveTypeInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<LeaveTypeGql> {
    return this.leaveTypesService.create(actor, access.workspaceId, input);
  }

  @Mutation(() => LeaveTypeGql)
  @RequirePermissions('hr.manage')
  updateLeaveType(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('leaveTypeId') leaveTypeId: string,
    @Args('input') input: UpdateLeaveTypeInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<LeaveTypeGql> {
    return this.leaveTypesService.update(actor, access.workspaceId, leaveTypeId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('hr.manage')
  async deleteLeaveType(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('leaveTypeId') leaveTypeId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.leaveTypesService.remove(actor, access.workspaceId, leaveTypeId);
    return true;
  }

  @Query(() => [LeaveRequestGql], { complexity: cappedListComplexity(MY_REQUESTS_LIMIT) })
  @RequirePermissions('leave.request')
  myLeaveRequests(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<LeaveRequestGql[]> {
    return this.leaveRequestsService.mine(actor, access.workspaceId);
  }

  @Query(() => LeaveRequestPageGql, { complexity: pagedComplexity, description: 'Approver queue, oldest first' })
  @RequirePermissions('leave.approve')
  leaveRequests(@Args() args: LeaveQueueArgs, @CurrentAccess() access: WorkspaceAccess): Promise<LeaveRequestPageGql> {
    return this.leaveRequestsService.queue(access.workspaceId, { status: args.status, page: args.page, pageSize: args.pageSize });
  }

  @Mutation(() => LeaveRequestGql)
  @RequirePermissions('leave.request')
  requestLeave(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: RequestLeaveInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<LeaveRequestGql> {
    return this.leaveRequestsService.request(actor, access.workspaceId, input);
  }

  @Mutation(() => LeaveRequestGql, { description: 'Approvers cannot decide on their own requests' })
  @RequirePermissions('leave.approve')
  decideLeaveRequest(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('requestId') requestId: string,
    @Args('input') input: DecideLeaveInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<LeaveRequestGql> {
    return this.leaveRequestsService.decide(actor, access, requestId, input);
  }

  @Mutation(() => LeaveRequestGql)
  @RequirePermissions('leave.request')
  cancelLeaveRequest(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('requestId') requestId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<LeaveRequestGql> {
    return this.leaveRequestsService.cancel(actor, access.workspaceId, requestId);
  }

  @Query(() => [LeaveBalanceGql])
  @RequirePermissions('leave.request')
  myLeaveBalances(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('year', { type: () => Int, nullable: true, description: '2000 to 2100; defaults to this year' }) year: number | undefined,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<LeaveBalanceGql[]> {
    const safeYear = year && year >= 2000 && year <= 2100 ? year : this.clock.now().getUTCFullYear();
    return this.leaveRequestsService.myBalances(actor, access.workspaceId, safeYear);
  }
}
