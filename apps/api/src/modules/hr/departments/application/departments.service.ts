import { Injectable } from '@nestjs/common';
import type { CreateDepartmentRequest, DepartmentResponse, UpdateDepartmentRequest } from '@taskflow/shared-types';
import { AuditLogger } from '../../../../core/audit/audit-logger.port.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import type { Actor } from '../../../../core/http/types/authenticated-request.js';
import { MembersService } from '../../../members/application/members.service.js';
import type { Department } from '../domain/department.js';
import { DepartmentRepository } from '../domain/department.repository.js';
import { DepartmentMapper } from './department.mapper.js';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly membersService: MembersService,
    private readonly auditLogger: AuditLogger,
  ) {}

  async list(workspaceId: string): Promise<DepartmentResponse[]> {
    const departments = await this.departments.listWithCounts(workspaceId);
    return departments.map(DepartmentMapper.toResponse);
  }

  async create(actor: Actor, workspaceId: string, request: CreateDepartmentRequest): Promise<DepartmentResponse> {
    const headUserId = request.headUserId ?? null;
    if (headUserId) await this.assertMember(workspaceId, headUserId);
    const department = await this.departments.create({ workspaceId, name: request.name.trim(), headUserId });
    await this.audit(actor, 'hr.department.create', department);
    return DepartmentMapper.toResponse({ ...department, memberCount: 0 });
  }

  async update(actor: Actor, workspaceId: string, departmentId: string, request: UpdateDepartmentRequest): Promise<DepartmentResponse> {
    const department = await this.getInWorkspace(workspaceId, departmentId);
    if (request.headUserId) await this.assertMember(workspaceId, request.headUserId);
    if (request.name !== undefined) department.name = request.name.trim();
    if (request.headUserId !== undefined) department.headUserId = request.headUserId;
    await this.departments.save(department);
    await this.audit(actor, 'hr.department.update', department, { fields: Object.keys(request) });
    const updated = (await this.departments.listWithCounts(workspaceId)).find((d) => d.id === departmentId);
    if (!updated) throw DomainError.notFound('Department');
    return DepartmentMapper.toResponse(updated);
  }

  async remove(actor: Actor, workspaceId: string, departmentId: string): Promise<void> {
    const department = await this.getInWorkspace(workspaceId, departmentId);
    await this.departments.delete(workspaceId, departmentId);
    await this.audit(actor, 'hr.department.delete', department);
  }

  async getInWorkspace(workspaceId: string, departmentId: string): Promise<Department> {
    const department = await this.departments.findInWorkspace(workspaceId, departmentId);
    if (!department) throw DomainError.notFound('Department');
    return department;
  }

  private async assertMember(workspaceId: string, userId: string): Promise<void> {
    if (!(await this.membersService.isMember(workspaceId, userId))) {
      throw DomainError.invalid('The department head must be a member of this workspace');
    }
  }

  private audit(actor: Actor, action: string, department: Department, metadata?: Record<string, unknown>) {
    return this.auditLogger.record(actor, {
      action,
      targetType: 'department',
      targetId: department.id,
      workspaceId: department.workspaceId,
      metadata: { name: department.name, ...metadata },
    });
  }
}
