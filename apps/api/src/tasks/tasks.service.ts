import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { PAGE_SIZE_DEFAULT } from '@taskflow/shared-types';
import type { Actor, WorkspaceAccess } from '../common/http/authenticated-request.js';
import { escapeLike } from '../common/http/escape-like.js';
import { ListsService } from '../lists/lists.service.js';
import { WorkspaceMemberEntity } from '../members/workspace-member.entity.js';
import type { CreateTaskDto, TaskDto, TaskPageDto, TaskQueryDto, UpdateTaskDto } from './dto/task.dto.js';
import { TaskEntity } from './entities/task.entity.js';

const POSITION_STEP = 1024;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(WorkspaceMemberEntity) private readonly members: Repository<WorkspaceMemberEntity>,
    private readonly listsService: ListsService,
  ) {}

  async listInList(workspaceId: string, listId: string, query: TaskQueryDto): Promise<TaskPageDto> {
    await this.listsService.findOrFail(workspaceId, listId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? PAGE_SIZE_DEFAULT;

    const builder = this.tasks
      .createQueryBuilder('task')
      .where('task.workspace_id = :workspaceId AND task.list_id = :listId', { workspaceId, listId });
    if (query.status) builder.andWhere('task.status = :status', { status: query.status });
    if (query.search) builder.andWhere('task.title ILIKE :search', { search: `%${escapeLike(query.search)}%` });

    const [items, total] = await builder
      .orderBy('task.position', 'ASC')
      .addOrderBy('task.created_at', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items: items.map(toTaskDto), page, pageSize, total };
  }

  async get(workspaceId: string, taskId: string): Promise<TaskDto> {
    return toTaskDto(await this.findOrFail(workspaceId, taskId));
  }

  async create(actor: Actor, access: WorkspaceAccess, listId: string, dto: CreateTaskDto): Promise<TaskDto> {
    const { workspaceId } = access;
    await this.listsService.findOrFail(workspaceId, listId);
    if (dto.assigneeId) await this.assertAssignable(access, dto.assigneeId);

    const status = dto.status ?? 'todo';
    const task = this.tasks.create({
      workspaceId,
      listId,
      title: dto.title.trim(),
      description: dto.description ?? '',
      status,
      priority: dto.priority ?? 'none',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      assigneeId: dto.assigneeId ?? null,
      position: await this.nextPosition(workspaceId, listId),
      createdById: actor.userId,
    });
    return toTaskDto(await this.tasks.save(task));
  }

  async update(access: WorkspaceAccess, taskId: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const task = await this.findOrFail(access.workspaceId, taskId);

    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      if (dto.assigneeId !== null) await this.assertAssignable(access, dto.assigneeId);
      else if (!access.permissions.has('task.assign')) throw new ForbiddenException('Missing task.assign permission');
      task.assigneeId = dto.assigneeId;
    }
    if (dto.title !== undefined) task.title = dto.title.trim();
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.position !== undefined) task.position = dto.position;

    return toTaskDto(await this.tasks.save(task));
  }

  async remove(workspaceId: string, taskId: string): Promise<void> {
    const task = await this.findOrFail(workspaceId, taskId);
    await this.tasks.delete({ id: task.id, workspaceId });
  }

  private async findOrFail(workspaceId: string, taskId: string): Promise<TaskEntity> {
    const task = await this.tasks.findOneBy({ id: taskId, workspaceId });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async assertAssignable(access: WorkspaceAccess, userId: string): Promise<void> {
    if (!access.permissions.has('task.assign')) throw new ForbiddenException('Missing task.assign permission');
    const isMember = await this.members.exists({ where: { workspaceId: access.workspaceId, userId } });
    if (!isMember) throw new BadRequestException('Assignee must be a member of this workspace');
  }

  private async nextPosition(workspaceId: string, listId: string): Promise<number> {
    const result = await this.tasks
      .createQueryBuilder('task')
      .select('MAX(task.position)', 'max')
      .where('task.workspace_id = :workspaceId AND task.list_id = :listId', { workspaceId, listId })
      .getRawOne<{ max: number | null }>();
    return (result?.max ?? 0) + POSITION_STEP;
  }
}

function toTaskDto(task: TaskEntity): TaskDto {
  return {
    id: task.id,
    listId: task.listId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assigneeId: task.assigneeId,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
