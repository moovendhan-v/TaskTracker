import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { DocTemplatesService } from '../../application/doc-templates.service.js';
import { DocTemplateGql, SaveDocTemplateInput } from './doc-template.types.js';

const PER_MINUTE = (limit: number) => ({ default: { limit, ttl: 60_000 } });

/** Doc templates. Reading needs doc.view; saving doc.create; deleting is the saver's or a doc manager's. */
@Resolver(() => DocTemplateGql)
export class DocTemplatesResolver {
  constructor(private readonly service: DocTemplatesService) {}

  @Query(() => [DocTemplateGql], { description: 'The built-in starters, then this workspace’s saved templates' })
  @RequirePermissions('doc.view')
  docTemplates(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<DocTemplateGql[]> {
    return this.service.list(access.workspaceId);
  }

  @Mutation(() => DocTemplateGql, { description: 'Keep a page as a template for this workspace' })
  @RequirePermissions('doc.create')
  @Throttle(PER_MINUTE(20))
  saveDocTemplate(@WorkspaceIdArg() _workspaceId: string, @Args('input') input: SaveDocTemplateInput, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<DocTemplateGql> {
    return this.service.save(actor, access.workspaceId, input);
  }

  @Mutation(() => Boolean, { description: 'Delete a saved template (whoever saved it, or someone with doc.manage)' })
  @RequirePermissions('doc.view')
  @Throttle(PER_MINUTE(20))
  deleteDocTemplate(@WorkspaceIdArg() _workspaceId: string, @UuidArg('templateId') templateId: string, @CurrentActor() actor: Actor, @CurrentAccess() access: WorkspaceAccess): Promise<boolean> {
    return this.service.remove(actor, access, templateId);
  }
}
