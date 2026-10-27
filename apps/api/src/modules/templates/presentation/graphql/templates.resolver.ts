import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TemplateContent } from '@taskflow/shared-types';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { JSONObjectScalar } from '../../../../core/graphql/json-object.scalar.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { SpaceGql } from '../../../spaces/presentation/graphql/space.types.js';
import { TemplatesService } from '../../application/templates.service.js';
import { CreateFromTemplateInput, ImportTemplateInput, SaveAsTemplateInput, TemplateGql } from './template.types.js';

const TEMPLATE_ID = { description: 'builtin:<key> or a template id' };

@Resolver(() => TemplateGql)
export class TemplatesResolver {
  constructor(private readonly templatesService: TemplatesService) {}

  @Query(() => [TemplateGql], { description: 'The built-in gallery and the workspace’s own templates' })
  @RequirePermissions()
  projectTemplates(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<TemplateGql[]> {
    return this.templatesService.list(access.workspaceId);
  }

  @Query(() => JSONObjectScalar, { description: 'A space as template content, to export without saving' })
  @RequirePermissions('space.manage')
  spaceTemplateContent(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('includeContent', { defaultValue: false }) includeContent: boolean,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TemplateContent> {
    return this.templatesService.contentOfSpace(access.workspaceId, spaceId, includeContent);
  }

  @Mutation(() => SpaceGql, { description: 'Creates a space from a template' })
  @RequirePermissions('space.manage', 'list.manage')
  createSpaceFromTemplate(
    @WorkspaceIdArg() _workspaceId: string,
    @Args('templateId', TEMPLATE_ID) templateId: string,
    @Args('input') input: CreateFromTemplateInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<SpaceGql> {
    return this.templatesService.apply(actor, access, templateId.slice(0, 80), input);
  }

  @Mutation(() => TemplateGql)
  @RequirePermissions('space.manage')
  saveSpaceAsTemplate(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('input') input: SaveAsTemplateInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<TemplateGql> {
    return this.templatesService.saveFromSpace(actor, access, spaceId, input);
  }

  @Mutation(() => TemplateGql, { description: 'Adds a template from an exported JSON file' })
  @RequirePermissions('space.manage')
  importTemplate(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: ImportTemplateInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<TemplateGql> {
    return this.templatesService.importJson(actor, access, input);
  }

  @Mutation(() => Boolean)
  @RequirePermissions('space.manage')
  async deleteTemplate(@WorkspaceIdArg() _workspaceId: string, @UuidArg('templateId') templateId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    await this.templatesService.remove(actor, access, templateId);
    return true;
  }
}
