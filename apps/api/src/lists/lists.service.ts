import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Actor } from '../common/http/authenticated-request.js';
import { AuditLogger } from '../audit/audit-logger.js';
import { SpacesService } from '../spaces/spaces.service.js';
import type { CreateTaskListDto, TaskListDto, UpdateTaskListDto } from './dto/task-list.dto.js';
import { TaskListEntity } from './entities/task-list.entity.js';

@Injectable()
export class ListsService {
  constructor(
    @InjectRepository(TaskListEntity) private readonly lists: Repository<TaskListEntity>,
    private readonly spacesService: SpacesService,
    private readonly auditLogger: AuditLogger,
  ) {}

  /** All lists in the workspace, for building the sidebar tree in one call. */
  async listForWorkspace(workspaceId: string): Promise<TaskListDto[]> {
    const lists = await this.lists.find({ where: { workspaceId }, order: { createdAt: 'ASC' } });
    return lists.map(toTaskListDto);
  }

  async create(actor: Actor, workspaceId: string, spaceId: string, dto: CreateTaskListDto): Promise<TaskListDto> {
    await this.spacesService.findOrFail(workspaceId, spaceId);
    const list = await this.lists.save(this.lists.create({ workspaceId, spaceId, name: dto.name.trim() }));
    await this.audit(actor, 'list.create', list);
    return toTaskListDto(list);
  }

  async update(actor: Actor, workspaceId: string, listId: string, dto: UpdateTaskListDto): Promise<TaskListDto> {
    const list = await this.findOrFail(workspaceId, listId);
    if (dto.name !== undefined) list.name = dto.name.trim();
    await this.lists.save(list);
    await this.audit(actor, 'list.update', list);
    return toTaskListDto(list);
  }

  async remove(actor: Actor, workspaceId: string, listId: string): Promise<void> {
    const list = await this.findOrFail(workspaceId, listId);
    await this.lists.delete({ id: list.id, workspaceId });
    await this.audit(actor, 'list.delete', list);
  }

  async findOrFail(workspaceId: string, listId: string): Promise<TaskListEntity> {
    const list = await this.lists.findOneBy({ id: listId, workspaceId });
    if (!list) throw new NotFoundException('List not found');
    return list;
  }

  private audit(actor: Actor, action: string, list: TaskListEntity) {
    return this.auditLogger.record(actor, {
      action,
      targetType: 'list',
      targetId: list.id,
      workspaceId: list.workspaceId,
      metadata: { name: list.name, spaceId: list.spaceId },
    });
  }
}

function toTaskListDto(list: TaskListEntity): TaskListDto {
  return { id: list.id, spaceId: list.spaceId, name: list.name, createdAt: list.createdAt.toISOString() };
}
