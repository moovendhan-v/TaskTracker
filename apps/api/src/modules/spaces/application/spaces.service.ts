import { Injectable } from '@nestjs/common';
import type { CreateSpaceRequest, CustomFieldValues, SpaceResponse, UpdateSpaceRequest } from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { DomainError } from '../../../core/domain/domain-error.js';
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
      icon: request.icon ?? null,
    });
    return SpaceMapper.toResponse(space);
  }

  @Audited('space.update', auditName)
  @Announces('space.updated')
  async update(_actor: Actor, workspaceId: string, spaceId: string, request: UpdateSpaceRequest): Promise<SpaceResponse> {
    const space = await this.getInWorkspace(workspaceId, spaceId);
    SpaceGuard.assert(space.id, 'space.manage');
    if (request.name !== undefined) space.name = request.name.trim();
    if (request.color !== undefined) space.color = request.color;
    if (request.icon !== undefined) space.icon = request.icon;
    if (request.status !== undefined) space.status = request.status;
    if (request.statusNote !== undefined) space.statusNote = request.statusNote.trim();
    if (request.startDate !== undefined) space.startDate = request.startDate;
    if (request.dueDate !== undefined) space.dueDate = request.dueDate;
    if (space.startDate && space.dueDate && space.dueDate < space.startDate) throw DomainError.invalid('The due date must be on or after the start date');
    return SpaceMapper.toResponse(await this.spaces.save(space));
  }

  @Audited('space.delete', auditName)
  @Announces('space.deleted')
  async remove(_actor: Actor, workspaceId: string, spaceId: string): Promise<SpaceResponse> {
    const space = await this.getInWorkspace(workspaceId, spaceId);
    SpaceGuard.assert(space.id, 'space.manage');
    await this.spaces.delete(workspaceId, spaceId);
    return SpaceMapper.toResponse(space);
  }

  /** Stores already-validated custom field values (see CustomFieldsService.updateSpaceValues). */
  async mergeCustomFields(workspaceId: string, spaceId: string, values: CustomFieldValues): Promise<SpaceResponse> {
    const space = await this.getInWorkspace(workspaceId, spaceId);
    const next = { ...space.customFields };
    for (const [key, value] of Object.entries(values)) {
      if (value === null) delete next[key];
      else next[key] = value;
    }
    space.customFields = next;
    return SpaceMapper.toResponse(await this.spaces.save(space));
  }

  async getInWorkspace(workspaceId: string, spaceId: string): Promise<Space> {
    return found(await this.spaces.findInWorkspace(workspaceId, spaceId), 'Space');
  }
}
