import { Injectable } from '@nestjs/common';
import type { CreateDepartmentRequest, DepartmentResponse, UpdateDepartmentRequest } from '@taskflow/shared-types';
import { Audited } from '../../../../core/audit/audited.decorator.js';
import { Cached } from '../../../../core/cache/cached.decorator.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { found } from '../../../../core/domain/found.js';
import { Announces } from '../../../../core/events/announces.decorator.js';
import type { Actor } from '../../../../core/http/types/authenticated-request.js';
import { workspaceFromArg } from '../../../../core/runtime/change-target.js';
import { MembersService } from '../../../members/application/members.service.js';
import type { Department } from '../domain/department.js';
import { DepartmentRepository } from '../domain/department.repository.js';
import { DepartmentMapper } from './department.mapper.js';

const change = { ...workspaceFromArg, targetType: 'department', metadata: (department: DepartmentResponse) => ({ name: department.name }) };

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly membersService: MembersService,
  ) {}

  @Cached({ entities: ['department', 'employee'], shared: true })
  async list(workspaceId: string): Promise<DepartmentResponse[]> {
    const departments = await this.departments.listWithCounts(workspaceId);
    return departments.map(DepartmentMapper.toResponse);
  }

  @Audited('hr.department.create', change)
  @Announces('department.created', workspaceFromArg)
  async create(_actor: Actor, workspaceId: string, request: CreateDepartmentRequest): Promise<DepartmentResponse> {
    const headUserId = request.headUserId ?? null;
    if (headUserId) await this.assertMember(workspaceId, headUserId);
    const department = await this.departments.create({ workspaceId, name: request.name.trim(), headUserId });
    return DepartmentMapper.toResponse({ ...department, memberCount: 0 });
  }

  @Audited('hr.department.update', change)
  @Announces('department.updated', workspaceFromArg)
  async update(_actor: Actor, workspaceId: string, departmentId: string, request: UpdateDepartmentRequest): Promise<DepartmentResponse> {
    const department = await this.getInWorkspace(workspaceId, departmentId);
    if (request.headUserId) await this.assertMember(workspaceId, request.headUserId);
    if (request.name !== undefined) department.name = request.name.trim();
    if (request.headUserId !== undefined) department.headUserId = request.headUserId;
    await this.departments.save(department);
    const updated = (await this.departments.listWithCounts(workspaceId)).find((d) => d.id === departmentId);
    return DepartmentMapper.toResponse(found(updated, 'Department'));
  }

  @Audited('hr.department.delete', change)
  @Announces('department.deleted', workspaceFromArg)
  async remove(_actor: Actor, workspaceId: string, departmentId: string): Promise<DepartmentResponse> {
    const department = await this.getInWorkspace(workspaceId, departmentId);
    await this.departments.delete(workspaceId, departmentId);
    return DepartmentMapper.toResponse({ ...department, memberCount: 0 });
  }

  async getInWorkspace(workspaceId: string, departmentId: string): Promise<Department> {
    return found(await this.departments.findInWorkspace(workspaceId, departmentId), 'Department');
  }

  private async assertMember(workspaceId: string, userId: string): Promise<void> {
    if (!(await this.membersService.isMember(workspaceId, userId))) {
      throw DomainError.invalid('The department head must be a member of this workspace');
    }
  }
}
