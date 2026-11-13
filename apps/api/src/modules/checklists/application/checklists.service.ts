import { Injectable } from '@nestjs/common';
import { CHECKLIST_TITLE_MAX, TASK_CHECKLIST_MAX, type ChecklistItemResponse } from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { ChecklistRepository, type ChecklistItemRecord } from '../domain/checklist.repository.js';

/** A step is one line of text: line breaks and control characters become spaces. */
// eslint-disable-next-line no-control-regex
const BREAKS = /[\u0000-\u001F\u007F\u2028\u2029]+/g;

export function cleanStepTitle(value: string): string {
  const title = value.replace(BREAKS, ' ').replace(/\s+/g, ' ').trim();
  if (!title) throw DomainError.invalid('Write what the step is');
  if (title.length > CHECKLIST_TITLE_MAX) throw DomainError.invalid(`Steps can be at most ${CHECKLIST_TITLE_MAX} characters`);
  return title;
}

/**
 * A task's checklist (C2): ordered steps to tick off. Seeing them follows the task
 * (row-level security); changing them needs task.update in the task's space.
 */
@Injectable()
export class ChecklistsService {
  constructor(
    private readonly checklists: ChecklistRepository,
    private readonly events: EventBus,
  ) {}

  async list(access: WorkspaceAccess, taskId: string): Promise<ChecklistItemResponse[]> {
    await this.space(access, taskId);
    return (await this.checklists.list(access.workspaceId, taskId)).map(toResponse);
  }

  async add(actor: Actor, access: WorkspaceAccess, taskId: string, title: string): Promise<ChecklistItemResponse> {
    SpaceGuard.assert(await this.space(access, taskId), 'task.update');
    const clean = cleanStepTitle(title);
    const items = await this.checklists.list(access.workspaceId, taskId);
    if (items.length >= TASK_CHECKLIST_MAX) throw DomainError.invalid(`A task can have at most ${TASK_CHECKLIST_MAX} steps`);
    const position = (items.at(-1)?.position ?? 0) + 1;
    const item = await this.checklists.insert({ workspaceId: access.workspaceId, taskId, title: clean, position, createdBy: actor.userId });
    await this.announce(actor, access, taskId);
    return toResponse(item);
  }

  /** Renames a step, or ticks / unticks it (recording who and when). */
  async update(actor: Actor, access: WorkspaceAccess, itemId: string, changes: { title?: string | null; done?: boolean | null }): Promise<ChecklistItemResponse> {
    const item = await this.editable(access, itemId);
    const saved = await this.checklists.update(access.workspaceId, item.id, {
      ...(changes.title != null && { title: cleanStepTitle(changes.title) }),
      ...(changes.done != null && { done: changes.done ? { by: actor.userId } : false }),
    });
    if (!saved) throw DomainError.notFound('Step');
    await this.announce(actor, access, item.taskId);
    return toResponse(saved);
  }

  /** Moves a step before another one of the same task, or to the end (no `beforeId`). */
  async move(actor: Actor, access: WorkspaceAccess, itemId: string, beforeId: string | null): Promise<ChecklistItemResponse[]> {
    const item = await this.editable(access, itemId);
    const others = (await this.checklists.list(access.workspaceId, item.taskId)).filter((other) => other.id !== item.id);
    let position: number;
    if (!beforeId) {
      position = (others.at(-1)?.position ?? 0) + 1;
    } else {
      const index = others.findIndex((other) => other.id === beforeId);
      if (index < 0) throw DomainError.invalid('Move it next to a step of the same task');
      const after = others[index]!.position;
      const before = index > 0 ? others[index - 1]!.position : after - 1;
      position = (before + after) / 2;
    }
    await this.checklists.update(access.workspaceId, item.id, { position });
    await this.announce(actor, access, item.taskId);
    return (await this.checklists.list(access.workspaceId, item.taskId)).map(toResponse);
  }

  async remove(actor: Actor, access: WorkspaceAccess, itemId: string): Promise<boolean> {
    const item = await this.editable(access, itemId);
    await this.checklists.delete(access.workspaceId, item.id);
    await this.announce(actor, access, item.taskId);
    return true;
  }

  private async space(access: WorkspaceAccess, taskId: string): Promise<string> {
    const spaceId = await this.checklists.taskSpace(access.workspaceId, taskId);
    if (!spaceId) throw DomainError.notFound('Task');
    return spaceId;
  }

  private async editable(access: WorkspaceAccess, itemId: string): Promise<ChecklistItemRecord> {
    const item = await this.checklists.find(access.workspaceId, itemId);
    if (!item) throw DomainError.notFound('Step');
    SpaceGuard.assert(await this.space(access, item.taskId), 'task.update');
    return item;
  }

  /** Ids only, like every live event: viewers refetch the checklist through this API. */
  private announce(actor: Actor, access: WorkspaceAccess, taskId: string): Promise<void> {
    return this.events.publish(domainEvent('task_checklist', 'updated', { workspaceId: access.workspaceId, entityId: taskId, actorId: actor.userId }));
  }
}

function toResponse(item: ChecklistItemRecord): ChecklistItemResponse {
  return {
    id: item.id,
    taskId: item.taskId,
    title: item.title,
    done: item.done,
    doneAt: item.doneAt?.toISOString() ?? null,
    doneByName: item.doneByName,
    position: item.position,
    createdAt: item.createdAt.toISOString(),
  };
}
