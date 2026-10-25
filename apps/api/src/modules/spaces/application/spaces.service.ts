import { Injectable } from '@nestjs/common';
import type { CreateSpaceRequest, SpaceResponse, UpdateSpaceRequest } from '@taskflow/shared-types';
import { Audited } from '../../../core/audit/audited.decorator.js';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { found } from '../../../core/domain/found.js';
import { Announces } from '../../../core/events/announces.decorator.js';
import type { Actor } from '../../../core/http/types/authenticated-request.js';
import { DEFAULT_SPACE_COLOR, type Space } from '../domain/space.js';
import { SpaceRepository } from '../domain/space.repository.js';
import { SpaceMapper } from './space.mapper.js';

const auditName = { metadata: (space: SpaceResponse) => ({ name: space.name }) };

@Injectable()
export class SpacesService {
  constructor(private readonly spaces: SpaceRepository) {}

  @Cached({ entities: ['space'], shared: true })
  async list(workspaceId: string): Promise<SpaceResponse[]> {
    const spaces = await this.spaces.listByWorkspace(workspaceId);
    return spaces.map(SpaceMapper.toResponse);
  }

  @Audited('space.create', auditName)
  @Announces('space.created')
  async create(_actor: Actor, workspaceId: string, request: CreateSpaceRequest): Promise<SpaceResponse> {
    const space = await this.spaces.create({
      workspaceId,
      name: request.name.trim(),
      color: request.color ?? DEFAULT_SPACE_COLOR,
    });
    return SpaceMapper.toResponse(space);
  }

  @Audited('space.update', auditName)
  @Announces('space.updated')
  async update(_actor: Actor, workspaceId: string, spaceId: string, request: UpdateSpaceRequest): Promise<SpaceResponse> {
    const space = await this.getInWorkspace(workspaceId, spaceId);
    if (request.name !== undefined) space.name = request.name.trim();
    if (request.color !== undefined) space.color = request.color;
    return SpaceMapper.toResponse(await this.spaces.save(space));
  }

  @Audited('space.delete', auditName)
  @Announces('space.deleted')
  async remove(_actor: Actor, workspaceId: string, spaceId: string): Promise<SpaceResponse> {
    const space = await this.getInWorkspace(workspaceId, spaceId);
    await this.spaces.delete(workspaceId, spaceId);
    return SpaceMapper.toResponse(space);
  }

  async getInWorkspace(workspaceId: string, spaceId: string): Promise<Space> {
    return found(await this.spaces.findInWorkspace(workspaceId, spaceId), 'Space');
  }
}
