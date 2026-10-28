import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { AutomationAction, AutomationConditions, AutomationRunStatus, AutomationTrigger } from '@taskflow/shared-types';
import { TenantOrmEntity } from '../../../core/database/base.orm-entity.js';
import type { AutomationRule, AutomationRun } from '../domain/automation-rule.js';

@Entity({ name: 'automation_rule' })
export class AutomationRuleOrmEntity extends TenantOrmEntity implements AutomationRule {
  @Column({ type: 'uuid' })
  spaceId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'varchar', length: 40 })
  triggerType: AutomationTrigger['type'];

  @Column({ type: 'jsonb' })
  trigger: AutomationTrigger;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  conditions: AutomationConditions;

  @Column({ type: 'jsonb' })
  actions: AutomationAction[];

  @Column({ type: 'text', nullable: true })
  createdById: string | null;

  @Column({ type: 'integer', default: 0 })
  runCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;
}

@Entity({ name: 'automation_run' })
export class AutomationRunOrmEntity implements AutomationRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid' })
  ruleId: string;

  @Column({ type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({ type: 'varchar', length: 10 })
  status: AutomationRunStatus;

  @Column({ type: 'varchar', length: 300, default: '' })
  message: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
