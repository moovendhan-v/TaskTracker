import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PROTECTED_FIELDS } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { PoliciesService } from '../../application/policies.service.js';
import { FieldDefinitionGql, MyAccessGql, PolicyDocumentInput, PolicyGql, SavePolicyInput } from './policy.types.js';
import { RoleGql } from './role.types.js';

const POLICY_REF = { description: 'managed:<key> or a custom policy id' };

@Resolver(() => PolicyGql)
export class PoliciesResolver {
  constructor(private readonly policiesService: PoliciesService) {}

  @Query(() => [PolicyGql], { description: 'Managed and custom policies, with how many roles use each' })
  @RequirePermissions('roles.manage')
  policies(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<PolicyGql[]> {
    return this.policiesService.list(access.workspaceId);
  }

  @Query(() => [FieldDefinitionGql], { description: 'Data fields whose visibility policies control' })
  @RequirePermissions()
  protectedFields(@WorkspaceIdArg() _workspaceId: string): FieldDefinitionGql[] {
    return [...PROTECTED_FIELDS];
  }

  @Query(() => MyAccessGql, { description: "The caller's effective permissions and readable fields in the workspace" })
  @RequirePermissions()
  myAccess(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): MyAccessGql {
    return { permissions: [...access.permissions].sort(), readableFields: [...access.readableFields].sort() };
  }

  @Mutation(() => PolicyGql)
  @RequirePermissions('roles.manage')
  createPolicy(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: SavePolicyInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<PolicyGql> {
    return this.policiesService.create(actor, access, input);
  }

  @Mutation(() => PolicyGql)
  @RequirePermissions('roles.manage')
  updatePolicy(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('policyId') policyId: string,
    @Args('input') input: SavePolicyInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<PolicyGql> {
    return this.policiesService.update(actor, access, policyId, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('roles.manage')
  async deletePolicy(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('policyId') policyId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.policiesService.remove(actor, access, policyId);
    return true;
  }

  @Mutation(() => RoleGql)
  @RequirePermissions('roles.manage')
  attachRolePolicy(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('roleId') roleId: string,
    @Args('policy', POLICY_REF) policy: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<RoleGql> {
    return this.policiesService.attach(actor, access, roleId, policy.slice(0, 80));
  }

  @Mutation(() => RoleGql)
  @RequirePermissions('roles.manage')
  detachRolePolicy(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('roleId') roleId: string,
    @Args('policy', POLICY_REF) policy: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<RoleGql> {
    return this.policiesService.detach(actor, access, roleId, policy.slice(0, 80));
  }

  @Mutation(() => RoleGql, { description: "Replaces a role's inline policy (statements that belong to that role only)" })
  @RequirePermissions('roles.manage')
  setRoleInlinePolicy(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('roleId') roleId: string,
    @Args('document') document: PolicyDocumentInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<RoleGql> {
    return this.policiesService.setInline(actor, access, roleId, document);
  }
}
