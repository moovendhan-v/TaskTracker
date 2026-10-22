import { Injectable } from '@nestjs/common';
import type { CreateLeaveTypeRequest, LeaveTypeResponse, UpdateLeaveTypeRequest } from '@taskflow/shared-types';
import { AuditLogger } from '../../../../core/audit/audit-logger.port.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import type { Actor } from '../../../../core/http/types/authenticated-request.js';
import type { LeaveType } from '../domain/leave-type.js';
import { LeaveTypeRepository } from '../domain/leave-type.repository.js';
import { LeaveMapper } from './leave.mapper.js';

const DEFAULT_COLOR = '#0ea5e9';

@Injectable()
export class LeaveTypesService {
  constructor(
    private readonly leaveTypes: LeaveTypeRepository,
    private readonly auditLogger: AuditLogger,
  ) {}

  async list(workspaceId: string): Promise<LeaveTypeResponse[]> {
    return (await this.leaveTypes.list(workspaceId)).map(LeaveMapper.type);
  }

  async create(actor: Actor, workspaceId: string, request: CreateLeaveTypeRequest): Promise<LeaveTypeResponse> {
    const leaveType = await this.leaveTypes.create({
      workspaceId,
      name: request.name.trim(),
      color: request.color ?? DEFAULT_COLOR,
      annualAllowanceDays: request.annualAllowanceDays,
      requiresApproval: request.requiresApproval ?? true,
    });
    await this.audit(actor, 'hr.leave_type.create', leaveType);
    return LeaveMapper.type(leaveType);
  }

  async update(actor: Actor, workspaceId: string, leaveTypeId: string, request: UpdateLeaveTypeRequest): Promise<LeaveTypeResponse> {
    const leaveType = await this.getInWorkspace(workspaceId, leaveTypeId);
    if (request.name !== undefined) leaveType.name = request.name.trim();
    if (request.color !== undefined) leaveType.color = request.color;
    if (request.annualAllowanceDays !== undefined) leaveType.annualAllowanceDays = request.annualAllowanceDays;
    if (request.requiresApproval !== undefined) leaveType.requiresApproval = request.requiresApproval;
    const saved = await this.leaveTypes.save(leaveType);
    await this.audit(actor, 'hr.leave_type.update', saved, { fields: Object.keys(request) });
    return LeaveMapper.type(saved);
  }

  async remove(actor: Actor, workspaceId: string, leaveTypeId: string): Promise<void> {
    const leaveType = await this.getInWorkspace(workspaceId, leaveTypeId);
    await this.leaveTypes.delete(workspaceId, leaveTypeId);
    await this.audit(actor, 'hr.leave_type.delete', leaveType);
  }

  async getInWorkspace(workspaceId: string, leaveTypeId: string): Promise<LeaveType> {
    const leaveType = await this.leaveTypes.findInWorkspace(workspaceId, leaveTypeId);
    if (!leaveType) throw DomainError.notFound('Leave type');
    return leaveType;
  }

  private audit(actor: Actor, action: string, leaveType: LeaveType, metadata?: Record<string, unknown>) {
    return this.auditLogger.record(actor, {
      action,
      targetType: 'leave_type',
      targetId: leaveType.id,
      workspaceId: leaveType.workspaceId,
      metadata: { name: leaveType.name, annualAllowanceDays: leaveType.annualAllowanceDays, ...metadata },
    });
  }
}
