import { Injectable } from '@nestjs/common';
import { TransactionalManager } from '../../../../core/database/transactional-manager.js';
import type { LeaveType, NewLeaveType } from '../domain/leave-type.js';
import { LeaveTypeRepository } from '../domain/leave-type.repository.js';
import { LeaveTypeOrmEntity } from './leave-type.orm-entity.js';

@Injectable()
export class TypeOrmLeaveTypeRepository extends LeaveTypeRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(LeaveTypeOrmEntity);
  }

  list(workspaceId: string): Promise<LeaveType[]> {
    return this.repository.find({ where: { workspaceId }, order: { name: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, leaveTypeId: string): Promise<LeaveType | null> {
    return this.repository.findOneBy({ id: leaveTypeId, workspaceId });
  }

  create(leaveType: NewLeaveType): Promise<LeaveType> {
    return this.repository.save(this.repository.create(leaveType));
  }

  save(leaveType: LeaveType): Promise<LeaveType> {
    return this.repository.save(this.repository.create(leaveType));
  }

  async delete(workspaceId: string, leaveTypeId: string): Promise<void> {
    await this.repository.delete({ id: leaveTypeId, workspaceId });
  }
}
