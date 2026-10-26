import { Injectable } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import type { CustomPolicy, NewCustomPolicy, PolicyAttachment } from '../domain/policy.js';
import { PolicyRepository } from '../domain/policy.repository.js';
import { PolicyOrmEntity } from './policy.orm-entity.js';
import { RolePolicyOrmEntity } from './role-policy.orm-entity.js';

@Injectable()
export class TypeOrmPolicyRepository extends PolicyRepository {
  constructor(private readonly transactional: TransactionalManager) {
    super();
  }

  private get policies() {
    return this.transactional.repository(PolicyOrmEntity);
  }

  private get attachments() {
    return this.transactional.repository(RolePolicyOrmEntity);
  }

  list(workspaceId: string): Promise<CustomPolicy[]> {
    return this.policies.find({ where: { workspaceId }, order: { name: 'ASC' } });
  }

  findInWorkspace(workspaceId: string, policyId: string): Promise<CustomPolicy | null> {
    return this.policies.findOneBy({ id: policyId, workspaceId });
  }

  findMany(workspaceId: string, policyIds: readonly string[]): Promise<CustomPolicy[]> {
    if (policyIds.length === 0) return Promise.resolve([]);
    return this.policies.findBy({ workspaceId, id: In([...policyIds]) });
  }

  create(policy: NewCustomPolicy): Promise<CustomPolicy> {
    return this.policies.save(this.policies.create(policy));
  }

  save(policy: CustomPolicy): Promise<CustomPolicy> {
    return this.policies.save(this.policies.create(policy));
  }

  async delete(workspaceId: string, policyId: string): Promise<void> {
    await this.policies.delete({ id: policyId, workspaceId });
  }

  async listAttachments(workspaceId: string, roleIds?: readonly string[]): Promise<PolicyAttachment[]> {
    const rows = await this.attachments.find({
      where: roleIds ? { workspaceId, roleId: In([...roleIds]) } : { workspaceId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(({ roleId, managedKey, policyId }) => ({ roleId, managedKey, policyId }));
  }

  async attach(workspaceId: string, attachment: PolicyAttachment): Promise<boolean> {
    const where = {
      workspaceId,
      roleId: attachment.roleId,
      managedKey: attachment.managedKey ?? IsNull(),
      policyId: attachment.policyId ?? IsNull(),
    };
    if (await this.attachments.existsBy(where)) return false;
    await this.attachments.insert({ workspaceId, ...attachment });
    return true;
  }

  async detach(workspaceId: string, attachment: PolicyAttachment): Promise<boolean> {
    const result = await this.attachments.delete({
      workspaceId,
      roleId: attachment.roleId,
      managedKey: attachment.managedKey ?? IsNull(),
      policyId: attachment.policyId ?? IsNull(),
    });
    return (result.affected ?? 0) > 0;
  }
}
