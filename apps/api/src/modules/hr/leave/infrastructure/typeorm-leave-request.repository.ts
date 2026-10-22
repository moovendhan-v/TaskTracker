import { Injectable } from '@nestjs/common';
import type { LeaveStatus } from '@taskflow/shared-types';
import type { SelectQueryBuilder } from 'typeorm';
import { TransactionalManager } from '../../../../core/database/transactional-manager.js';
import type { PageRequest } from '../../../../core/domain/page-request.js';
import type { LeaveRequest, LeaveRequestView, NewLeaveRequest } from '../domain/leave-request.js';
import { LeaveRequestRepository } from '../domain/leave-request.repository.js';
import { LeaveRequestOrmEntity } from './leave-request.orm-entity.js';

interface ViewRow {
  id: string;
  workspace_id: string;
  user_id: string;
  user_name: string | null;
  leave_type_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  decided_by_id: string | null;
  decided_at: Date | null;
  decision_note: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class TypeOrmLeaveRequestRepository extends LeaveRequestRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(LeaveRequestOrmEntity);
  }

  async findInWorkspace(workspaceId: string, requestId: string): Promise<LeaveRequestView | null> {
    const row = await this.viewQuery()
      .where('request.workspace_id = :workspaceId AND request.id = :requestId', { workspaceId, requestId })
      .getRawOne<ViewRow>();
    return row ? toView(row) : null;
  }

  async listForUser(workspaceId: string, userId: string, limit: number): Promise<LeaveRequestView[]> {
    const rows = await this.viewQuery()
      .where('request.workspace_id = :workspaceId AND request.user_id = :userId', { workspaceId, userId })
      .orderBy('request.start_date', 'DESC')
      .limit(limit)
      .getRawMany<ViewRow>();
    return rows.map(toView);
  }

  async page(workspaceId: string, status: LeaveStatus | undefined, page: PageRequest): Promise<{ items: LeaveRequestView[]; total: number }> {
    const filtered = (query: SelectQueryBuilder<LeaveRequestOrmEntity>) => {
      query.where('request.workspace_id = :workspaceId', { workspaceId });
      if (status) query.andWhere('request.status = :status', { status });
      return query;
    };
    const [rows, total] = await Promise.all([
      filtered(this.viewQuery())
        .orderBy('request.created_at', 'ASC')
        .offset((page.page - 1) * page.pageSize)
        .limit(page.pageSize)
        .getRawMany<ViewRow>(),
      filtered(this.repository.createQueryBuilder('request')).getCount(),
    ]);
    return { items: rows.map(toView), total };
  }

  hasOverlap(workspaceId: string, userId: string, startDate: string, endDate: string): Promise<boolean> {
    return this.repository
      .createQueryBuilder('request')
      .where('request.workspace_id = :workspaceId AND request.user_id = :userId', { workspaceId, userId })
      .andWhere('request.status IN (:...active)', { active: ['pending', 'approved'] })
      .andWhere('request.start_date <= :endDate AND request.end_date >= :startDate', { startDate, endDate })
      .getExists();
  }

  async pendingDaysByType(workspaceId: string, userId: string, year: number): Promise<Map<string, number>> {
    const rows = await this.repository
      .createQueryBuilder('request')
      .select('request.leave_type_id', 'leave_type_id')
      .addSelect('SUM(request.days)', 'days')
      .where('request.workspace_id = :workspaceId AND request.user_id = :userId', { workspaceId, userId })
      .andWhere("request.status = 'pending' AND EXTRACT(YEAR FROM request.start_date) = :year", { year })
      .groupBy('request.leave_type_id')
      .getRawMany<{ leave_type_id: string; days: string }>();
    return new Map(rows.map((row) => [row.leave_type_id, Number(row.days)]));
  }

  create(request: NewLeaveRequest): Promise<LeaveRequest> {
    return this.repository.save(this.repository.create({ decidedById: null, decidedAt: null, decisionNote: '', ...request }));
  }

  save(request: LeaveRequest): Promise<LeaveRequest> {
    return this.repository.save(this.repository.create(request));
  }

  private viewQuery(): SelectQueryBuilder<LeaveRequestOrmEntity> {
    return this.repository
      .createQueryBuilder('request')
      .innerJoin('leave_type', 'leave_type', 'leave_type.id = request.leave_type_id')
      .leftJoin('user', 'account', 'account.id = request.user_id')
      .select([
        'request.id AS id',
        'request.workspace_id AS workspace_id',
        'request.user_id AS user_id',
        'account.name AS user_name',
        'request.leave_type_id AS leave_type_id',
        'leave_type.name AS leave_type_name',
        "to_char(request.start_date, 'YYYY-MM-DD') AS start_date",
        "to_char(request.end_date, 'YYYY-MM-DD') AS end_date",
        'request.days AS days',
        'request.reason AS reason',
        'request.status AS status',
        'request.decided_by_id AS decided_by_id',
        'request.decided_at AS decided_at',
        'request.decision_note AS decision_note',
        'request.created_at AS created_at',
        'request.updated_at AS updated_at',
      ]);
  }
}

function toView(row: ViewRow): LeaveRequestView {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    userName: row.user_name ?? 'Former member',
    leaveTypeId: row.leave_type_id,
    leaveTypeName: row.leave_type_name,
    startDate: row.start_date,
    endDate: row.end_date,
    days: Number(row.days),
    reason: row.reason,
    status: row.status,
    decidedById: row.decided_by_id,
    decidedAt: row.decided_at ? new Date(row.decided_at) : null,
    decisionNote: row.decision_note,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
