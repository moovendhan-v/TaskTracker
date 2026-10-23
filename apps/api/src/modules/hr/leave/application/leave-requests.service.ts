import { Injectable } from '@nestjs/common';
import type {
  CreateLeaveRequestRequest,
  DecideLeaveRequestRequest,
  LeaveBalanceResponse,
  LeaveRequestQuery,
  LeaveRequestResponse,
  Paginated,
} from '@taskflow/shared-types';
import { AuditLogger } from '../../../../core/audit/audit-logger.port.js';
import { UnitOfWork } from '../../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { toPageRequest } from '../../../../core/domain/page-request.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../../core/time/clock.port.js';
import { LeaveApprovalPolicy } from '../domain/leave-approval.policy.js';
import { LeaveBalanceRepository, type BalanceKey } from '../domain/leave-balance.repository.js';
import { leaveYear, type LeaveRequest, type LeaveRequestView } from '../domain/leave-request.js';
import { LeaveRequestPolicy } from '../domain/leave-request.policy.js';
import { LeaveRequestRepository } from '../domain/leave-request.repository.js';
import type { LeaveType } from '../domain/leave-type.js';
import { LeaveTypesService } from './leave-types.service.js';
import { LeaveMapper } from './leave.mapper.js';

const MY_REQUESTS_LIMIT = 100;

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly requests: LeaveRequestRepository,
    private readonly balances: LeaveBalanceRepository,
    private readonly leaveTypesService: LeaveTypesService,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogger: AuditLogger,
    private readonly clock: Clock,
  ) {}

  async mine(actor: Actor, workspaceId: string): Promise<LeaveRequestResponse[]> {
    const requests = await this.requests.listForUser(workspaceId, actor.userId, MY_REQUESTS_LIMIT);
    return requests.map(LeaveMapper.request);
  }

  async queue(workspaceId: string, query: LeaveRequestQuery): Promise<Paginated<LeaveRequestResponse>> {
    const page = toPageRequest(query);
    const result = await this.requests.page(workspaceId, query.status, page);
    return { items: result.items.map(LeaveMapper.request), total: result.total, ...page };
  }

  /** Books time off. Types that don't need approval are approved at once, still within the allowance. */
  async request(actor: Actor, workspaceId: string, body: CreateLeaveRequestRequest): Promise<LeaveRequestResponse> {
    const created = await this.unitOfWork.run(async () => {
      const leaveType = await this.leaveTypesService.getInWorkspace(workspaceId, body.leaveTypeId);
      const days = LeaveRequestPolicy.validateRange(body.startDate, body.endDate);
      LeaveRequestPolicy.assertNoOverlap(await this.requests.hasOverlap(workspaceId, actor.userId, body.startDate, body.endDate));

      const key: BalanceKey = { workspaceId, userId: actor.userId, leaveTypeId: leaveType.id, year: leaveYear(body.startDate) };
      const used = await this.balances.lockUsedDays(key);
      const pending = (await this.requests.pendingDaysByType(workspaceId, actor.userId, key.year)).get(leaveType.id) ?? 0;
      LeaveApprovalPolicy.assertWithinAllowance(leaveType.annualAllowanceDays, used + pending, days);

      const autoApprove = !leaveType.requiresApproval;
      const request = await this.requests.create({
        workspaceId,
        userId: actor.userId,
        leaveTypeId: leaveType.id,
        startDate: body.startDate,
        endDate: body.endDate,
        days,
        reason: body.reason?.trim() ?? '',
        status: autoApprove ? 'approved' : 'pending',
        ...(autoApprove && { decidedAt: this.clock.now(), decisionNote: 'Approved automatically' }),
      });
      if (autoApprove) await this.balances.addUsedDays(key, days);
      return request;
    });
    return LeaveMapper.request(await this.getView(workspaceId, created.id));
  }

  async decide(actor: Actor, access: WorkspaceAccess, requestId: string, body: DecideLeaveRequestRequest): Promise<LeaveRequestResponse> {
    await this.unitOfWork.run(async () => {
      const request = await this.getView(access.workspaceId, requestId);
      LeaveApprovalPolicy.assertCanDecide(request, actor.userId, access.permissions);

      if (body.decision === 'approved') {
        const leaveType = await this.leaveTypesService.getInWorkspace(access.workspaceId, request.leaveTypeId);
        await this.commitDays(request, leaveType);
      }
      await this.requests.save({
        ...toRequest(request),
        status: body.decision,
        decidedById: actor.userId,
        decidedAt: this.clock.now(),
        decisionNote: body.note?.trim() ?? '',
      });
      await this.auditLogger.record(actor, {
        action: `hr.leave.${body.decision}`,
        targetType: 'leave_request',
        targetId: request.id,
        workspaceId: access.workspaceId,
        metadata: { employee: request.userId, days: request.days, leaveType: request.leaveTypeName },
      });
    });
    return LeaveMapper.request(await this.getView(access.workspaceId, requestId));
  }

  async cancel(actor: Actor, workspaceId: string, requestId: string): Promise<LeaveRequestResponse> {
    await this.unitOfWork.run(async () => {
      const request = await this.getView(workspaceId, requestId);
      LeaveApprovalPolicy.assertCanCancel(request, actor.userId, this.today());
      if (request.status === 'approved') {
        const key = this.keyFor(request);
        await this.balances.lockUsedDays(key);
        await this.balances.addUsedDays(key, -request.days);
        await this.auditLogger.record(actor, {
          action: 'hr.leave.cancel_approved',
          targetType: 'leave_request',
          targetId: request.id,
          workspaceId,
          metadata: { days: request.days },
        });
      }
      await this.requests.save({ ...toRequest(request), status: 'cancelled' });
    });
    return LeaveMapper.request(await this.getView(workspaceId, requestId));
  }

  async myBalances(actor: Actor, workspaceId: string, year: number): Promise<LeaveBalanceResponse[]> {
    // Sequential on purpose: an operation's queries share one transaction connection, which runs one query at a time.
    const types = await this.leaveTypesService.list(workspaceId);
    const used = await this.balances.usedDaysByType(workspaceId, actor.userId, year);
    const pending = await this.requests.pendingDaysByType(workspaceId, actor.userId, year);
    return types.map((type) => LeaveMapper.balance(type, year, used.get(type.id) ?? 0, pending.get(type.id) ?? 0));
  }

  /** Locks the balance row, checks the allowance and records the days, all in the caller's transaction. */
  private async commitDays(request: LeaveRequest, leaveType: LeaveType): Promise<void> {
    const key = this.keyFor(request);
    const used = await this.balances.lockUsedDays(key);
    LeaveApprovalPolicy.assertWithinAllowance(leaveType.annualAllowanceDays, used, request.days);
    await this.balances.addUsedDays(key, request.days);
  }

  private keyFor(request: LeaveRequest): BalanceKey {
    return { workspaceId: request.workspaceId, userId: request.userId, leaveTypeId: request.leaveTypeId, year: leaveYear(request.startDate) };
  }

  private today(): string {
    return this.clock.now().toISOString().slice(0, 10);
  }

  private async getView(workspaceId: string, requestId: string): Promise<LeaveRequestView> {
    const request = await this.requests.findInWorkspace(workspaceId, requestId);
    if (!request) throw DomainError.notFound('Leave request');
    return request;
  }
}

function toRequest({ userName: _userName, leaveTypeName: _typeName, ...request }: LeaveRequestView): LeaveRequest {
  return request;
}
