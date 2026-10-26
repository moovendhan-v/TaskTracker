import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { CustomFieldEntity, CustomFieldValues } from '@taskflow/shared-types';
import { CustomFieldValuesScalar } from '../../../../core/graphql/custom-field-values.scalar.js';
import { SpaceGql } from '../../../spaces/presentation/graphql/space.types.js';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CustomFieldEntityEnum } from '../../../../core/graphql/enums.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { CustomFieldsService } from '../../application/custom-fields.service.js';
import { CreateCustomFieldInput, CustomFieldGql, UpdateCustomFieldInput } from './custom-field.types.js';

@Resolver(() => CustomFieldGql)
export class CustomFieldsResolver {
  constructor(private readonly fieldsService: CustomFieldsService) {}

  @Query(() => [CustomFieldGql])
  @RequirePermissions()
  customFields(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('entity', { type: () => CustomFieldEntityEnum, nullable: true }) entity: CustomFieldEntity | null,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<CustomFieldGql[]> {
    return this.fieldsService.list(access.workspaceId, entity ?? undefined);
  }

  @Mutation(() => CustomFieldGql)
  @RequirePermissions('space.manage')
  createCustomField(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('input') input: CreateCustomFieldInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<CustomFieldGql> {
    return this.fieldsService.create(actor, access.workspaceId, input);
  }

  @Mutation(() => CustomFieldGql)
  @RequirePermissions('space.manage')
  updateCustomField(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('fieldId') fieldId: string,
    @Args('input') input: UpdateCustomFieldInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<CustomFieldGql> {
    return this.fieldsService.update(actor, access.workspaceId, fieldId, input);
  }

  @Mutation(() => Boolean, { description: 'Deletes the field and its values everywhere' })
  @RequirePermissions('space.manage')
  async deleteCustomField(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('fieldId') fieldId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.fieldsService.remove(actor, access.workspaceId, fieldId);
    return true;
  }

  @Mutation(() => SpaceGql, { description: "Sets a space's custom field values; a value of null clears it" })
  @RequirePermissions('space.manage')
  setSpaceCustomFields(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('values', { type: () => CustomFieldValuesScalar }) values: CustomFieldValues,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<SpaceGql> {
    return this.fieldsService.updateSpaceValues(actor, access.workspaceId, spaceId, values);
  }
}
