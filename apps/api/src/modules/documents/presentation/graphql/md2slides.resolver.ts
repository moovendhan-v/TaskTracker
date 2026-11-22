import { Query, Resolver } from '@nestjs/graphql';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { Md2SlidesService } from '../../md2slides/md2slides.service.js';
import { Md2SlidesCatalogGql } from './md2slides.types.js';

/** md2slides' community templates, contributors and snippets, for writing slide docs (doc.view). */
@Resolver()
export class Md2SlidesResolver {
  constructor(private readonly md2slides: Md2SlidesService) {}

  @Query(() => Md2SlidesCatalogGql, { description: 'Community templates, contributors and snippets from md2slides' })
  @RequirePermissions('doc.view')
  async md2slidesCatalog(@WorkspaceIdArg() _workspaceId: string): Promise<Md2SlidesCatalogGql> {
    const { templates, contributors, snippets, source, updatedAt } = await this.md2slides.catalog();
    return { templates, contributors, snippets, source, updatedAt };
  }
}
