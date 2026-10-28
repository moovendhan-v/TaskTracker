import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { AutomationRule, AutomationRun, NewAutomationRule, NewAutomationRun } from '../domain/automation-rule.js';
import { AutomationRepository } from '../domain/automation.repository.js';
import { AutomationRuleOrmEntity, AutomationRunOrmEntity } from './automation.orm-entities.js';

/** Runs kept per rule; older ones are dropped as new ones arrive. */
const RUNS_KEPT = 100;

@Injectable()
export class TypeOrmAutomationRepository extends AutomationRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get rules() {
    return this.transactional.repository(AutomationRuleOrmEntity);
  }

  private get runs() {
    return this.transactional.repository(AutomationRunOrmEntity);
  }

  listInSpace(workspaceId: string, spaceId: string): Promise<AutomationRule[]> {
    return this.rules.find({ where: { workspaceId, spaceId }, order: { createdAt: 'ASC' } });
  }

  countInSpace(workspaceId: string, spaceId: string): Promise<number> {
    return this.rules.countBy({ workspaceId, spaceId });
  }

  listEnabledFor(workspaceId: string, triggerTypes: readonly string[]): Promise<AutomationRule[]> {
    return this.rules.find({ where: { workspaceId, enabled: true, triggerType: In([...triggerTypes]) as never }, order: { createdAt: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, ruleId: string): Promise<AutomationRule | null> {
    return this.rules.findOneBy({ id: ruleId, workspaceId });
  }

  create(rule: NewAutomationRule): Promise<AutomationRule> {
    return this.rules.save(this.rules.create(rule));
  }

  save(rule: AutomationRule): Promise<AutomationRule> {
    return this.rules.save(this.rules.create(rule));
  }

  async delete(workspaceId: string, ruleId: string): Promise<void> {
    await this.rules.delete({ id: ruleId, workspaceId });
  }

  async markRun(workspaceId: string, ruleId: string, at: Date): Promise<void> {
    await this.rules.update({ id: ruleId, workspaceId }, { runCount: () => 'run_count + 1', lastRunAt: at } as never);
  }

  async recordRun(run: NewAutomationRun): Promise<void> {
    await this.runs.insert(run);
    await this.transactional.manager.query(
      `DELETE FROM automation_run WHERE workspace_id = $1 AND rule_id = $2 AND id NOT IN (
         SELECT id FROM automation_run WHERE workspace_id = $1 AND rule_id = $2 ORDER BY created_at DESC LIMIT $3)`,
      [run.workspaceId, run.ruleId, RUNS_KEPT],
    );
  }

  listRuns(workspaceId: string, ruleId: string, limit: number): Promise<AutomationRun[]> {
    return this.runs.find({ where: { workspaceId, ruleId }, order: { createdAt: 'DESC' }, take: limit });
  }
}
