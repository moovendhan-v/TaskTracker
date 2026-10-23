import { Injectable } from '@nestjs/common';
import type { EmployeeResponse, UpsertEmployeeProfileRequest } from '@taskflow/shared-types';
import { AuditLogger } from '../../../../core/audit/audit-logger.port.js';
import { UnitOfWork } from '../../../../core/database/unit-of-work.port.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import type { Actor } from '../../../../core/http/types/authenticated-request.js';
import { MembersService } from '../../../members/application/members.service.js';
import { DepartmentsService } from '../../departments/application/departments.service.js';
import type { DirectoryEntry, ProfileFields } from '../domain/employee-profile.js';
import { EmployeeProfileRepository } from '../domain/employee-profile.repository.js';
import { ReportingLinePolicy } from '../domain/reporting-line.policy.js';
import { EmployeeMapper } from './employee.mapper.js';

const DIRECTORY_LIMIT = 500;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly profiles: EmployeeProfileRepository,
    private readonly membersService: MembersService,
    private readonly departmentsService: DepartmentsService,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogger: AuditLogger,
  ) {}

  async directory(workspaceId: string): Promise<EmployeeResponse[]> {
    const entries = await this.profiles.directory(workspaceId, DIRECTORY_LIMIT);
    return entries.map(EmployeeMapper.toResponse);
  }

  async get(workspaceId: string, userId: string): Promise<EmployeeResponse> {
    return EmployeeMapper.toResponse(await this.getEntry(workspaceId, userId));
  }

  /** Creates or updates a profile. Fields left out keep their current value. */
  async upsert(actor: Actor, workspaceId: string, userId: string, request: UpsertEmployeeProfileRequest): Promise<EmployeeResponse> {
    await this.unitOfWork.run(async () => {
      const current = await this.getEntry(workspaceId, userId);
      const next: ProfileFields = {
        jobTitle: request.jobTitle === undefined ? current.jobTitle : request.jobTitle?.trim() || null,
        departmentId: request.departmentId === undefined ? current.departmentId : request.departmentId,
        managerUserId: request.managerUserId === undefined ? current.managerUserId : request.managerUserId,
        employmentType: request.employmentType === undefined ? current.employmentType : request.employmentType,
        startDate: request.startDate === undefined ? current.startDate : request.startDate,
      };

      if (next.departmentId && next.departmentId !== current.departmentId) {
        await this.departmentsService.getInWorkspace(workspaceId, next.departmentId);
      }
      if (next.managerUserId && next.managerUserId !== current.managerUserId) {
        if (!(await this.membersService.isMember(workspaceId, next.managerUserId))) {
          throw DomainError.invalid('The manager must be a member of this workspace');
        }
        const chain = [next.managerUserId, ...(await this.profiles.managerChain(workspaceId, next.managerUserId))];
        ReportingLinePolicy.assertValidManager(userId, chain);
      }

      await this.profiles.upsert(workspaceId, userId, next);
      await this.auditLogger.record(actor, {
        action: 'hr.profile.update',
        targetType: 'user',
        targetId: userId,
        workspaceId,
        metadata: { fields: Object.keys(request) },
      });
    });
    return this.get(workspaceId, userId);
  }

  private async getEntry(workspaceId: string, userId: string): Promise<DirectoryEntry> {
    const entry = await this.profiles.findEntry(workspaceId, userId);
    if (!entry) throw DomainError.notFound('Employee');
    return entry;
  }
}
