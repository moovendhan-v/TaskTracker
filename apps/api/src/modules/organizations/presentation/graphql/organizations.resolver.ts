import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { isOrgRole, isTwoStepRequirement, ORG_NAME_MAX } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { DomainError } from '../../../../core/domain/domain-error.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, AuthenticatedRequest, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { OrganizationsService } from '../../application/organizations.service.js';
import {
  OrganizationActivityGql,
  OrganizationGql,
  OrganizationMemberGql,
  OrganizationSsoGql,
  OrganizationSsoInput,
  OrganizationWorkspaceGql,
  WorkspaceOrganizationGql,
} from './organization.types.js';
import { CurrentRequest } from '../../../../core/http/decorators/current-request.decorator.js';

const role = (value: string) => {
  if (!isOrgRole(value)) throw DomainError.invalid('Role must be owner, admin or member');
  return value;
};
const name = (value: string) => {
  if (value.length > ORG_NAME_MAX * 2) throw DomainError.invalid(`Give the organization a name of up to ${ORG_NAME_MAX} characters`);
  return value;
};

/**
 * Organizations (A3). Signed-in only (the global session guard); membership and roles are
 * checked in OrganizationsService. Moving a workspace in or out also needs workspace.manage.
 */
@Resolver(() => OrganizationGql)
export class OrganizationsResolver {
  constructor(private readonly service: OrganizationsService) {}

  @Query(() => [OrganizationGql], { description: 'Organizations the caller belongs to' })
  organizations(@CurrentActor() actor: Actor): Promise<OrganizationGql[]> {
    return this.service.listMine(actor.userId);
  }

  @Query(() => OrganizationGql)
  organization(@UuidArg('organizationId') organizationId: string, @CurrentActor() actor: Actor): Promise<OrganizationGql> {
    return this.service.get(actor, organizationId);
  }

  @Query(() => [OrganizationMemberGql])
  organizationMembers(@UuidArg('organizationId') organizationId: string, @CurrentActor() actor: Actor): Promise<OrganizationMemberGql[]> {
    return this.service.members(actor, organizationId);
  }

  @Query(() => [OrganizationWorkspaceGql], { description: 'Its workspaces, by name; being in the organization does not let you into them' })
  organizationWorkspaces(@UuidArg('organizationId') organizationId: string, @CurrentActor() actor: Actor): Promise<OrganizationWorkspaceGql[]> {
    return this.service.workspaces(actor, organizationId);
  }

  @Query(() => [OrganizationActivityGql], { description: 'Latest organization activity; owners and admins only' })
  organizationActivity(@UuidArg('organizationId') organizationId: string, @CurrentActor() actor: Actor): Promise<OrganizationActivityGql[]> {
    return this.service.activity(actor, organizationId);
  }

  @Mutation(() => OrganizationGql)
  createOrganization(@Args('name') value: string, @CurrentActor() actor: Actor): Promise<OrganizationGql> {
    return this.service.create(actor, name(value));
  }

  @Mutation(() => OrganizationGql)
  renameOrganization(@UuidArg('organizationId') organizationId: string, @Args('name') value: string, @CurrentActor() actor: Actor): Promise<OrganizationGql> {
    return this.service.rename(actor, organizationId, name(value));
  }

  @Mutation(() => OrganizationGql, { description: 'Two-step sign-in required in all its workspaces' })
  setOrganizationTwoStep(@UuidArg('organizationId') organizationId: string, @Args('require') require: string, @CurrentActor() actor: Actor): Promise<OrganizationGql> {
    if (!isTwoStepRequirement(require)) throw DomainError.invalid('Require two-step sign-in of: off, admins or everyone');
    return this.service.setTwoStep(actor, organizationId, require);
  }

  @Mutation(() => Boolean, { description: 'Owners only; its workspaces stay, on their own' })
  deleteOrganization(@UuidArg('organizationId') organizationId: string, @CurrentActor() actor: Actor): Promise<boolean> {
    return this.service.delete(actor, organizationId);
  }

  @Mutation(() => [OrganizationMemberGql])
  addOrganizationMember(
    @UuidArg('organizationId') organizationId: string,
    @Args('email') email: string,
    @Args('role') value: string,
    @CurrentActor() actor: Actor,
  ): Promise<OrganizationMemberGql[]> {
    if (email.length > 320) throw DomainError.invalid('That email is too long');
    return this.service.addMember(actor, organizationId, email, role(value));
  }

  @Mutation(() => [OrganizationMemberGql])
  setOrganizationMemberRole(
    @UuidArg('organizationId') organizationId: string,
    @Args('userId') userId: string,
    @Args('role') value: string,
    @CurrentActor() actor: Actor,
  ): Promise<OrganizationMemberGql[]> {
    return this.service.setRole(actor, organizationId, userId.slice(0, 100), role(value));
  }

  @Mutation(() => [OrganizationMemberGql], { description: 'Owners and admins remove people; anyone can remove themselves (leave)' })
  removeOrganizationMember(@UuidArg('organizationId') organizationId: string, @Args('userId') userId: string, @CurrentActor() actor: Actor): Promise<OrganizationMemberGql[]> {
    return this.service.removeMember(actor, organizationId, userId.slice(0, 100));
  }

  @Query(() => OrganizationSsoGql, { nullable: true, description: 'SSO for the organization (owners and admins)' })
  organizationSso(@UuidArg('organizationId') organizationId: string, @CurrentActor() actor: Actor, @CurrentRequest() request: AuthenticatedRequest): Promise<OrganizationSsoGql | null> {
    return this.service.sso(actor, request.headers, organizationId);
  }

  @Mutation(() => OrganizationSsoGql, { nullable: true, description: 'Owners, with two-step sign-in; replaces any SSO it had' })
  setOrganizationSso(
    @UuidArg('organizationId') organizationId: string,
    @Args('input') input: OrganizationSsoInput,
    @CurrentActor() actor: Actor,
    @CurrentRequest() request: AuthenticatedRequest,
  ): Promise<OrganizationSsoGql | null> {
    return this.service.setSso(actor, request.headers, organizationId, input);
  }

  @Mutation(() => OrganizationSsoGql, { nullable: true, description: 'Checks the DNS record that proves the domain' })
  verifyOrganizationSsoDomain(@UuidArg('organizationId') organizationId: string, @CurrentActor() actor: Actor, @CurrentRequest() request: AuthenticatedRequest): Promise<OrganizationSsoGql | null> {
    return this.service.verifySsoDomain(actor, request.headers, organizationId);
  }

  @Mutation(() => Boolean)
  removeOrganizationSso(@UuidArg('organizationId') organizationId: string, @CurrentActor() actor: Actor, @CurrentRequest() request: AuthenticatedRequest): Promise<boolean> {
    return this.service.removeSso(actor, request.headers, organizationId);
  }

  @Query(() => WorkspaceOrganizationGql, { nullable: true, description: 'The organization this workspace is in, if any' })
  @RequirePermissions()
  workspaceOrganization(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<WorkspaceOrganizationGql | null> {
    return this.service.ofWorkspace(access);
  }

  @Mutation(() => Boolean, { description: 'Needs workspace.manage here and owner or admin in the organization' })
  @RequirePermissions('workspace.manage')
  async addWorkspaceToOrganization(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('organizationId') organizationId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.service.attachWorkspace(actor, access, organizationId);
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermissions('workspace.manage')
  async removeWorkspaceFromOrganization(@WorkspaceIdArg() _workspaceId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.service.detachWorkspace(actor, access);
    return true;
  }
}
