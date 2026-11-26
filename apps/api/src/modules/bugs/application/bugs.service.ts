import { Injectable } from '@nestjs/common';
import {
  SEVERITY_PRIORITY,
  stepsFromActions,
  type BugCaptureResponse,
  type BugFilter,
  type BugQaState,
  type BugResponse,
  type BugSource,
  type ReportBugRequest,
  type SimilarBugResponse,
  type TaskResponse,
  type UpdateBugRequest,
} from '@taskflow/shared-types';
import { SpaceGuard } from '../../../core/access/space-guard.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { domainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { ListsService } from '../../lists/application/lists.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import { TaskActivityRepository } from '../../tasks/domain/task-extras.repository.js';
import { BugPolicy } from '../domain/bug.policy.js';
import { BugRepository, type BugChanges, type BugRecord } from '../domain/bug.repository.js';

const LIST_LIMIT = 200;

/** Who filed a report that didn't come from a signed-in member (the feedback portal or the SDK). */
export interface ExternalReporter {
  name: string | null;
  email: string | null;
}

/**
 * E6 bug reports. A report is created as a task of type "bug" through the task service (so its
 * permission checks, events, automations and activity all apply), then gets its QA details and
 * redacted diagnostics. Reading follows the task: whoever can open the task can open the report.
 */
@Injectable()
export class BugsService {
  constructor(
    private readonly bugs: BugRepository,
    private readonly tasksService: TasksService,
    private readonly listsService: ListsService,
    private readonly activity: TaskActivityRepository,
    private readonly eventBus: EventBus,
  ) {}

  async report(actor: Actor, access: WorkspaceAccess, request: ReportBugRequest, source: BugSource = 'app', reporter?: ExternalReporter): Promise<BugResponse> {
    const title = BugPolicy.title(request.title);
    const kind = BugPolicy.kind(request.kind);
    const severity = BugPolicy.severity(request.severity);
    const environment = BugPolicy.environment(request.environment);
    const expected = BugPolicy.longText(request.expected, 'Expected result');
    const actual = BugPolicy.longText(request.actual, 'Actual result');
    const capture = BugPolicy.capture(request.capture);
    const context = BugPolicy.context(request.context);
    const steps = [...BugPolicy.manualSteps(request.steps), ...stepsFromActions(capture.actions)].slice(0, 50);

    if (request.listId) {
      const list = await this.listsService.getInWorkspace(access.workspaceId, request.listId);
      if (list.spaceId !== request.spaceId) throw DomainError.invalid('Pick a list of this project');
    }
    const body = { title, type: 'bug' as const, priority: SEVERITY_PRIORITY[severity], description: describe(expected, actual) };
    const task = request.listId ? await this.tasksService.create(actor, access, request.listId, body) : await this.tasksService.createInSpace(actor, access, request.spaceId, body);

    await this.bugs.insert(
      {
        taskId: task.id,
        workspaceId: access.workspaceId,
        kind,
        severity,
        environment,
        module: BugPolicy.module(request.module),
        expected,
        actual,
        steps,
        qaState: 'new',
        source,
        ...context,
        reporterId: reporter ? null : actor.userId,
        reporterName: reporter?.name ?? null,
        reporterEmail: reporter?.email ?? null,
      },
      capture,
    );
    return this.get(access, task.id);
  }

  async get(access: WorkspaceAccess, taskId: string): Promise<BugResponse> {
    const task = await this.tasksService.get(access.workspaceId, taskId);
    const record = await this.bugs.find(access.workspaceId, task.id);
    if (!record) throw DomainError.notFound('Bug report');
    return toResponse(record, task);
  }

  async list(access: WorkspaceAccess, spaceId: string, filter: BugFilter): Promise<BugResponse[]> {
    SpaceGuard.assert(spaceId, 'task.view');
    const records = await this.bugs.list(access.workspaceId, spaceId, filter, LIST_LIMIT);
    const tasks = await Promise.all(records.map((record) => this.tasksService.get(access.workspaceId, record.taskId)));
    return records.map((record, index) => toResponse(record, tasks[index]!));
  }

  async capture(access: WorkspaceAccess, taskId: string): Promise<BugCaptureResponse> {
    await this.get(access, taskId);
    return (await this.bugs.capture(access.workspaceId, taskId)) ?? { console: [], network: [], actions: [] };
  }

  async update(actor: Actor, access: WorkspaceAccess, taskId: string, request: UpdateBugRequest): Promise<BugResponse> {
    const before = await this.editable(access, taskId);
    const changes: BugChanges = {};
    if (request.kind !== undefined && request.kind !== null) changes.kind = BugPolicy.kind(request.kind, before.kind);
    if (request.severity !== undefined && request.severity !== null) changes.severity = BugPolicy.severity(request.severity, before.severity);
    if (request.environment !== undefined && request.environment !== null) changes.environment = BugPolicy.environment(request.environment, before.environment);
    if (request.module !== undefined) changes.module = BugPolicy.module(request.module);
    if (request.expected !== undefined && request.expected !== null) changes.expected = BugPolicy.longText(request.expected, 'Expected result');
    if (request.actual !== undefined && request.actual !== null) changes.actual = BugPolicy.longText(request.actual, 'Actual result');
    if (request.steps !== undefined && request.steps !== null) changes.steps = BugPolicy.steps(request.steps);
    await this.bugs.update(access.workspaceId, taskId, changes);
    await this.recordChanges(actor, access.workspaceId, taskId, before, changes);
    return this.get(access, taskId);
  }

  /** Moves QA along: confirm, mark fixed, ask for a retest, verify, reopen, close. */
  async setQaState(actor: Actor, access: WorkspaceAccess, taskId: string, to: BugQaState): Promise<BugResponse> {
    const before = await this.editable(access, taskId);
    if (to === 'duplicate') throw DomainError.invalid('Mark it as a duplicate of another report instead');
    BugPolicy.assertTransition(before.qaState, to);
    await this.bugs.update(access.workspaceId, taskId, { qaState: to });
    await this.recordChanges(actor, access.workspaceId, taskId, before, { qaState: to });
    return this.get(access, taskId);
  }

  /** Links the report to the one it duplicates (a `duplicates` task relation) and closes it as a duplicate. */
  async markDuplicate(actor: Actor, access: WorkspaceAccess, taskId: string, ofTaskId: string): Promise<BugResponse> {
    const before = await this.editable(access, taskId);
    if (taskId === ofTaskId) throw DomainError.invalid("A report can't duplicate itself");
    const original = await this.get(access, ofTaskId);
    if (original.duplicateOfTaskId === taskId) throw DomainError.invalid('That report is already a duplicate of this one');
    await this.tasksService.addRelation(actor, access.workspaceId, taskId, ofTaskId, 'duplicates');
    await this.bugs.update(access.workspaceId, taskId, { qaState: 'duplicate' });
    await this.recordChanges(actor, access.workspaceId, taskId, before, { qaState: 'duplicate' });
    return this.get(access, taskId);
  }

  /** Reports in the project whose titles look like this one (most alike first), for spotting duplicates. */
  async similar(access: WorkspaceAccess, spaceId: string, title: string, excludeTaskId: string | null): Promise<SimilarBugResponse[]> {
    SpaceGuard.assert(spaceId, 'task.view');
    const cleaned = title.trim().slice(0, 200);
    if (cleaned.length < 4) return [];
    return this.bugs.similar(access.workspaceId, spaceId, cleaned, excludeTaskId, 5);
  }

  private async editable(access: WorkspaceAccess, taskId: string): Promise<BugResponse> {
    const bug = await this.get(access, taskId);
    SpaceGuard.assert(bug.spaceId, 'task.update');
    return bug;
  }

  private async recordChanges(actor: Actor, workspaceId: string, taskId: string, before: BugResponse, changes: BugChanges): Promise<void> {
    const fields: [keyof BugChanges, string][] = [
      ['kind', 'report kind'],
      ['severity', 'severity'],
      ['environment', 'environment'],
      ['module', 'module'],
      ['qaState', 'QA state'],
    ];
    const entries = fields.flatMap(([key, label]) => {
      const from = before[key as keyof BugResponse] as string | null;
      const to = changes[key] as string | null | undefined;
      return to !== undefined && to !== from ? [{ workspaceId, taskId, actorId: actor.userId, kind: 'changed', field: label, fromValue: from?.slice(0, 300) ?? null, toValue: to?.slice(0, 300) ?? null }] : [];
    });
    if (changes.expected !== undefined && changes.expected !== before.expected) entries.push({ workspaceId, taskId, actorId: actor.userId, kind: 'changed', field: 'expected result', fromValue: null, toValue: null });
    if (changes.actual !== undefined && changes.actual !== before.actual) entries.push({ workspaceId, taskId, actorId: actor.userId, kind: 'changed', field: 'actual result', fromValue: null, toValue: null });
    if (changes.steps !== undefined) entries.push({ workspaceId, taskId, actorId: actor.userId, kind: 'changed', field: 'steps', fromValue: null, toValue: null });
    if (!entries.length) return;
    await this.activity.record(entries);
    // A task change as far as everyone else is concerned: refreshes caches (task activity), open pages and subscribers.
    await this.eventBus.publish(
      domainEvent('task', 'updated', { workspaceId, entityId: taskId, actorId: actor.userId, facts: { title: before.title, number: before.number, listId: before.listId, spaceId: before.spaceId } }),
    );
  }
}

/** The task description: expected and actual, so the task reads well on its own too. */
function describe(expected: string, actual: string): string {
  return [expected ? `**Expected**\n\n${expected}` : '', actual ? `**Actual**\n\n${actual}` : ''].filter(Boolean).join('\n\n');
}

function toResponse(record: BugRecord, task: TaskResponse): BugResponse {
  return {
    taskId: task.id,
    number: task.number,
    title: task.title,
    spaceId: task.spaceId,
    listId: task.listId,
    statusName: task.status.name,
    statusCategory: task.status.category,
    priority: task.priority,
    assigneeIds: task.assigneeIds,
    kind: record.kind,
    severity: record.severity,
    environment: record.environment,
    module: record.module,
    expected: record.expected,
    actual: record.actual,
    steps: record.steps,
    qaState: record.qaState,
    source: record.source,
    pageUrl: record.pageUrl,
    browser: record.browser,
    os: record.os,
    viewport: record.viewport,
    reporterId: record.reporterId,
    reporterName: record.reporterName,
    duplicateOfTaskId: record.duplicateOfTaskId,
    consoleErrors: record.consoleErrors,
    failedRequests: record.failedRequests,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
