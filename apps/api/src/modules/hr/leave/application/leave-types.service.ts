import { Injectable } from '@nestjs/common';
import type { CreateLeaveTypeRequest, LeaveTypeResponse, UpdateLeaveTypeRequest } from '@taskflow/shared-types';
import { Audited } from '../../../../core/audit/audited.decorator.js';
import { Cached } from '../../../../core/cache/cached.decorator.js';
import { found } from '../../../../core/domain/found.js';
import { Announces } from '../../../../core/events/announces.decorator.js';
import type { Actor } from '../../../../core/http/types/authenticated-request.js';
import { workspaceFromArg } from '../../../../core/runtime/change-target.js';
import type { LeaveType } from '../domain/leave-type.js';
import { LeaveTypeRepository } from '../domain/leave-type.repository.js';
import { LeaveMapper } from './leave.mapper.js';

const DEFAULT_COLOR = '#0ea5e9';

const change = {
  ...workspaceFromArg,
  targetType: 'leave_type',
  metadata: (leaveType: LeaveTypeResponse) => ({ name: leaveType.name, annualAllowanceDays: leaveType.annualAllowanceDays }),
};

@Injectable()
export class LeaveTypesService {
  constructor(private readonly leaveTypes: LeaveTypeRepository) {}

  @Cached({ entities: ['leave_type'], shared: true })
  async list(workspaceId: string): Promise<LeaveTypeResponse[]> {
    return (await this.leaveTypes.list(workspaceId)).map(LeaveMapper.type);
  }

  @Audited('hr.leave_type.create', change)
  @Announces('leave_type.created', workspaceFromArg)
  async create(_actor: Actor, workspaceId: string, request: CreateLeaveTypeRequest): Promise<LeaveTypeResponse> {
    const leaveType = await this.leaveTypes.create({
      workspaceId,
      name: request.name.trim(),
      color: request.color ?? DEFAULT_COLOR,
      annualAllowanceDays: request.annualAllowanceDays,
      requiresApproval: request.requiresApproval ?? true,
    });
    return LeaveMapper.type(leaveType);
  }

  @Audited('hr.leave_type.update', change)
  @Announces('leave_type.updated', workspaceFromArg)
  async update(_actor: Actor, workspaceId: string, leaveTypeId: string, request: UpdateLeaveTypeRequest): Promise<LeaveTypeResponse> {
    const leaveType = await this.getInWorkspace(workspaceId, leaveTypeId);
    if (request.name !== undefined) leaveType.name = request.name.trim();
    if (request.color !== undefined) leaveType.color = request.color;
    if (request.annualAllowanceDays !== undefined) leaveType.annualAllowanceDays = request.annualAllowanceDays;
    if (request.requiresApproval !== undefined) leaveType.requiresApproval = request.requiresApproval;
    return LeaveMapper.type(await this.leaveTypes.save(leaveType));
  }

  @Audited('hr.leave_type.delete', change)
  @Announces('leave_type.deleted', workspaceFromArg)
  async remove(_actor: Actor, workspaceId: string, leaveTypeId: string): Promise<LeaveTypeResponse> {
    const leaveType = await this.getInWorkspace(workspaceId, leaveTypeId);
    await this.leaveTypes.delete(workspaceId, leaveTypeId);
    return LeaveMapper.type(leaveType);
  }

  async getInWorkspace(workspaceId: string, leaveTypeId: string): Promise<LeaveType> {
    return found(await this.leaveTypes.findInWorkspace(workspaceId, leaveTypeId), 'Leave type');
  }
}
