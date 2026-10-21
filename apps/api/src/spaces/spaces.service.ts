import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Actor } from '../common/http/authenticated-request.js';
import { AuditLogger } from '../audit/audit-logger.js';
import type { CreateSpaceDto, SpaceDto, UpdateSpaceDto } from './dto/space.dto.js';
import { SpaceEntity } from './entities/space.entity.js';

const DEFAULT_COLOR = '#0ea5e9';

@Injectable()
export class SpacesService {
  constructor(
    @InjectRepository(SpaceEntity) private readonly spaces: Repository<SpaceEntity>,
    private readonly auditLogger: AuditLogger,
  ) {}

  async list(workspaceId: string): Promise<SpaceDto[]> {
    const spaces = await this.spaces.find({ where: { workspaceId }, order: { createdAt: 'ASC' } });
    return spaces.map(toSpaceDto);
  }

  async create(actor: Actor, workspaceId: string, dto: CreateSpaceDto): Promise<SpaceDto> {
    const space = await this.spaces.save(
      this.spaces.create({ workspaceId, name: dto.name.trim(), color: dto.color ?? DEFAULT_COLOR }),
    );
    await this.audit(actor, 'space.create', space);
    return toSpaceDto(space);
  }

  async update(actor: Actor, workspaceId: string, spaceId: string, dto: UpdateSpaceDto): Promise<SpaceDto> {
    const space = await this.findOrFail(workspaceId, spaceId);
    if (dto.name !== undefined) space.name = dto.name.trim();
    if (dto.color !== undefined) space.color = dto.color;
    await this.spaces.save(space);
    await this.audit(actor, 'space.update', space);
    return toSpaceDto(space);
  }

  async remove(actor: Actor, workspaceId: string, spaceId: string): Promise<void> {
    const space = await this.findOrFail(workspaceId, spaceId);
    await this.spaces.delete({ id: space.id, workspaceId });
    await this.audit(actor, 'space.delete', space);
  }

  async findOrFail(workspaceId: string, spaceId: string): Promise<SpaceEntity> {
    const space = await this.spaces.findOneBy({ id: spaceId, workspaceId });
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  private audit(actor: Actor, action: string, space: SpaceEntity) {
    return this.auditLogger.record(actor, {
      action,
      targetType: 'space',
      targetId: space.id,
      workspaceId: space.workspaceId,
      metadata: { name: space.name },
    });
  }
}

function toSpaceDto(space: SpaceEntity): SpaceDto {
  return {
    id: space.id,
    workspaceId: space.workspaceId,
    name: space.name,
    color: space.color,
    createdAt: space.createdAt.toISOString(),
  };
}
