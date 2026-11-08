import { Injectable } from '@nestjs/common';
import { isTwoStepRequirement, type TwoStepRequirement } from '@taskflow/shared-types';
import { In } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { NewWorkspace, Workspace } from '../domain/workspace.js';
import { WorkspaceRepository } from '../domain/workspace.repository.js';
import { WorkspaceOrmEntity } from './workspace.orm-entity.js';

@Injectable()
export class TypeOrmWorkspaceRepository extends WorkspaceRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get repository() {
    return this.transactional.repository(WorkspaceOrmEntity);
  }

  findById(id: string): Promise<Workspace | null> {
    return this.repository.findOneBy({ id });
  }

  async findByIds(ids: readonly string[]): Promise<Workspace[]> {
    if (ids.length === 0) return [];
    return this.repository.findBy({ id: In([...ids]) });
  }

  create(workspace: NewWorkspace): Promise<Workspace> {
    return this.repository.save(this.repository.create(workspace));
  }

  save(workspace: Workspace): Promise<Workspace> {
    return this.repository.save(this.repository.create(workspace));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async getTwoStep(id: string): Promise<TwoStepRequirement> {
    const [row] = (await this.transactional.manager.query(`SELECT two_step_required FROM workspace WHERE id = $1`, [id])) as { two_step_required: string }[];
    return isTwoStepRequirement(row?.two_step_required) ? row.two_step_required : 'off';
  }

  async organizationTwoStep(id: string): Promise<{ name: string; require: TwoStepRequirement } | null> {
    const [row] = (await this.transactional.manager.query(
      `SELECT o.name, o.two_step_required FROM workspace w JOIN organization o ON o.id = w.organization_id WHERE w.id = $1`,
      [id],
    )) as { name: string; two_step_required: string }[];
    return row ? { name: row.name, require: isTwoStepRequirement(row.two_step_required) ? row.two_step_required : 'everyone' } : null;
  }

  async setTwoStep(id: string, requirement: TwoStepRequirement): Promise<void> {
    await this.transactional.manager.query(`UPDATE workspace SET two_step_required = $2 WHERE id = $1`, [id, requirement]);
  }
}
