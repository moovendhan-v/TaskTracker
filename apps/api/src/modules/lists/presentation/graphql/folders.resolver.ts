import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { UuidArg, WorkspaceIdArg } from '../../../../core/graphql/args.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { FoldersService } from '../../application/folders.service.js';
import { CreateFolderInput, FolderGql, MoveFolderInput, UpdateFolderInput } from './task-list.types.js';

@Resolver(() => FolderGql)
export class FoldersResolver {
  constructor(private readonly foldersService: FoldersService) {}

  @Query(() => [FolderGql], { description: 'Every folder in the workspace, for the sidebar tree' })
  @RequirePermissions()
  folders(@WorkspaceIdArg() _workspaceId: string, @CurrentAccess() access: WorkspaceAccess): Promise<FolderGql[]> {
    return this.foldersService.listForWorkspace(access.workspaceId);
  }

  @Mutation(() => FolderGql)
  @RequirePermissions('list.manage')
  createFolder(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('spaceId') spaceId: string,
    @Args('input') input: CreateFolderInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<FolderGql> {
    return this.foldersService.create(actor, access.workspaceId, spaceId, input);
  }

  @Mutation(() => FolderGql)
  @RequirePermissions('list.manage')
  updateFolder(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('folderId') folderId: string,
    @Args('input') input: UpdateFolderInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<FolderGql> {
    return this.foldersService.update(actor, access.workspaceId, folderId, input);
  }

  @Mutation(() => FolderGql)
  @RequirePermissions('list.manage')
  moveFolder(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('folderId') folderId: string,
    @Args('input') input: MoveFolderInput,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<FolderGql> {
    return this.foldersService.move(actor, access.workspaceId, folderId, input);
  }

  @Mutation(() => Boolean, { description: 'Deletes the folder only; its lists and sub-folders move up a level' })
  @RequirePermissions('list.manage')
  async deleteFolder(
    @WorkspaceIdArg() _workspaceId: string,
    @UuidArg('folderId') folderId: string,
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
  ): Promise<boolean> {
    await this.foldersService.remove(actor, access.workspaceId, folderId);
    return true;
  }
}
