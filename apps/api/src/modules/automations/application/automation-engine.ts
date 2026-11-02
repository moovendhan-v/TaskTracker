import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  addDays,
  canInSpace,
  evaluateCondition,
  fillAutomationMessage,
  flowActions,
  flowFromRule,
  type AutomationAction,
  type AutomationTriggerType,
  type FlowStep,
  type FlowTaskFacts,
  type FlowTraceEntry,
  type TaskResponse,
} from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { DomainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../core/time/clock.port.js';
import { CommentsService } from '../../comments/application/comments.service.js';
import { MembersService } from '../../members/application/members.service.js';
import { NotificationsService } from '../../notifications/application/notifications.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import type { AutomationRule } from '../domain/automation-rule.js';
import { AutomationPolicy } from '../domain/automation.policy.js';
import { AutomationRepository } from '../domain/automation.repository.js';

/** What else a run knows about why it happened. */
export interface RunContext {
  /** Who made the change; null for outside events such as a GitHub webhook. */
  actorId: string | null;
  /** A pull request, for GitHub triggers: "Fix login (#42)". */
  pr?: string;
}

const SUBJECT_MAX = 300;
const TRACE_MAX = 60;
const EXCERPT_MAX = 140;

/**
 * Runs automation rules when tasks change. It listens on the in-process event
 * bus, so rules run in the same transaction as the change that fired them.
 *
 * - Each rule runs as the person who last saved it, with their access as it is
 *   now (permissions and space limits). If they left or lost a permission the
 *   rule needs, the run is skipped and logged.
 * - Each rule runs in its own savepoint: if it fails, only its own changes are
 *   undone and the user's change goes through.
 * - Changes made by a rule never fire other rules, so rules can't loop.
 */
@Injectable()
export class AutomationEngine implements OnModuleInit {
  /** Set while a rule's actions run; events raised then are ignored. */
  private static readonly running = new AsyncLocalStorage<true>();
  private readonly logger = new Logger(AutomationEngine.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly automations: AutomationRepository,
    private readonly tasksService: TasksService,
    private readonly membersService: MembersService,
    private readonly notificationsService: NotificationsService,
    private readonly accessService: AccessService,
    private readonly transactional: TransactionalManager,
    private readonly clock: Clock,
    private readonly commentsService: CommentsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe((event) => this.handle(event));
  }

  private async handle(event: DomainEvent): Promise<void> {
    if (AutomationEngine.running.getStore()) return;
    if (event.entityType !== 'task' && event.entityType !== 'comment') return;
    const triggers = AutomationPolicy.triggersForTaskEvent(event);
    const taskId = event.entityType === 'comment' ? event.facts?.taskId : event.entityId;
    if (triggers.length === 0 || !taskId) return;
    await this.run(event.workspaceId, triggers, taskId, { actorId: event.actorId });
  }

  /** Runs every enabled rule of the task's space that listens for one of `triggers`. Needs a workspace-scoped transaction. */
  async run(workspaceId: string, triggers: readonly AutomationTriggerType[], taskId: string, context: RunContext): Promise<void> {
    if (AutomationEngine.running.getStore()) return;
    const rules = await this.automations.listEnabledFor(workspaceId, triggers);
    if (rules.length === 0) return;
    let task: TaskResponse;
    try {
      task = await this.tasksService.get(workspaceId, taskId);
    } catch (error) {
      if (error instanceof DomainError) return;
      throw error;
    }
    const facts = { listId: task.listId, statusId: task.statusId, statusCategory: task.status.category, priority: task.priority, type: task.type };
    for (const rule of rules) {
      if (rule.spaceId !== task.spaceId) continue;
      if (!triggers.some((trigger) => AutomationPolicy.matches(rule, trigger, facts))) continue;
      await this.execute(rule, task, context);
    }
  }

  private async execute(rule: AutomationRule, task: TaskResponse, context: RunContext): Promise<void> {
    const flow = rule.flow ?? flowFromRule(rule.conditions, rule.actions);
    const trace: FlowTraceEntry[] = [];
    const record = (status: 'succeeded' | 'failed' | 'skipped', message: string) =>
      this.automations.recordRun({ workspaceId: rule.workspaceId, ruleId: rule.id, taskId: task.id, status, message: message.slice(0, 300), trace: trace.slice(0, TRACE_MAX) });

    const access = rule.createdById ? await this.accessService.resolveMember(rule.createdById, rule.workspaceId) : null;
    if (!rule.createdById || !access) return record('skipped', 'The person this automation runs as is no longer in the workspace');
    const missing = ['task.view' as const, ...AutomationPolicy.requiredPermissions(flowActions(flow))].filter((permission) => !canInSpace(access, rule.spaceId, permission));
    if (missing.length) return record('skipped', `The person this automation runs as no longer has ${missing.join(', ')} here`);

    const actor: Actor = { userId: rule.createdById, platformRole: 'USER', ip: null };
    try {
      await this.transactional.savepoint(() =>
        this.transactional.runInScope({ kind: 'workspace', workspaceId: rule.workspaceId, userId: actor.userId, spaceRules: access.spaceRules }, () =>
          AutomationEngine.running.run(true, () => this.runSteps(flow.steps, rule, actor, access, task.id, context, trace)),
        ),
      );
      await record('succeeded', '');
    } catch (error) {
      // Domain errors explain themselves; anything else stays in the server log. The savepoint undid every step.
      const message = error instanceof DomainError ? error.message : 'Something went wrong';
      const failed = trace[trace.length - 1];
      if (failed && failed.outcome === 'ran') trace[trace.length - 1] = { ...failed, outcome: 'failed', detail: message.slice(0, 200) };
      await record('failed', `${message} Nothing was changed.`);
      if (!(error instanceof DomainError)) this.logger.error(`Automation ${rule.id} failed`, error instanceof Error ? error.stack : undefined);
    }
    await this.automations.markRun(rule.workspaceId, rule.id, this.clock.now());
  }

  /**
   * Walks the flow in order. If-steps look at the task as it is at that moment, so an
   * earlier step's change counts. Returns false when a stop step ended the run.
   */
  private async runSteps(steps: readonly FlowStep[], rule: AutomationRule, actor: Actor, access: WorkspaceAccess, taskId: string, context: RunContext, trace: FlowTraceEntry[]): Promise<boolean> {
    for (const step of steps) {
      if (step.kind === 'stop') {
        trace.push({ stepId: step.id, outcome: 'stopped', detail: '' });
        return false;
      }
      if (step.kind === 'if') {
        const holds = evaluateCondition(step.condition, await this.factsOf(rule.workspaceId, taskId), this.clock.now().toISOString().slice(0, 10));
        trace.push({ stepId: step.id, outcome: holds ? 'took-yes' : 'took-no', detail: '' });
        if (!(await this.runSteps(holds ? step.yes : step.no, rule, actor, access, taskId, context, trace))) return false;
        continue;
      }
      // Marked as ran first: if the action throws, execute() turns this entry into the failure.
      trace.push({ stepId: step.id, outcome: 'ran', detail: '' });
      await this.applyAction(step.action, rule, actor, access, taskId, context);
    }
    return true;
  }

  private async factsOf(workspaceId: string, taskId: string): Promise<FlowTaskFacts> {
    const task = await this.tasksService.get(workspaceId, taskId);
    return {
      listId: task.listId,
      statusId: task.statusId,
      statusCategory: task.status.category,
      priority: task.priority,
      type: task.type,
      title: task.title,
      assigneeIds: task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [],
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : null,
    };
  }

  private async applyAction(action: AutomationAction, rule: AutomationRule, actor: Actor, access: WorkspaceAccess, taskId: string, context: RunContext): Promise<void> {
    switch (action.type) {
      case 'set_status':
        await this.tasksService.update(actor, access, taskId, { statusId: action.statusId as string });
        return;
      case 'set_priority':
        await this.tasksService.update(actor, access, taskId, { priority: action.priority ?? 'none' });
        return;
      case 'assign':
        await this.tasksService.update(actor, access, taskId, { assigneeId: action.userId as string });
        return;
      case 'unassign':
        await this.tasksService.update(actor, access, taskId, { assigneeId: null });
        return;
      case 'notify':
        await this.notify(rule, taskId, action, context);
        return;
      case 'comment': {
        const task = await this.tasksService.get(rule.workspaceId, taskId);
        const body = fillAutomationMessage(action.message ?? '', { task: `#${task.number} ${task.title}`, status: task.status.name, actor: 'Automation', pr: context.pr });
        await this.commentsService.create(actor, rule.workspaceId, taskId, { body });
        return;
      }
      case 'set_due_date':
        await this.tasksService.update(actor, access, taskId, { dueDate: action.days === null || action.days === undefined ? null : addDays(this.clock.now().toISOString().slice(0, 10), action.days) });
        return;
      case 'add_watcher':
        if (!(await this.membersService.isMember(rule.workspaceId, action.userId as string))) throw DomainError.invalid('That person is no longer in the workspace');
        await this.tasksService.addWatcher(actor, rule.workspaceId, taskId, action.userId as string);
        return;
    }
  }

  private async notify(rule: AutomationRule, taskId: string, action: AutomationRule['actions'][number], context: RunContext): Promise<void> {
    const task = await this.tasksService.get(rule.workspaceId, taskId);
    const members = new Map((await this.membersService.list(rule.workspaceId)).map((member) => [member.userId, member.name]));
    const audiences = new Set(action.audiences ?? []);
    const recipients = new Set<string>(action.userIds ?? []);
    if (audiences.has('assignee') && task.assigneeId) recipients.add(task.assigneeId);
    if (audiences.has('creator')) recipients.add(task.createdById);
    if (audiences.has('actor') && context.actorId) recipients.add(context.actorId);
    if (audiences.has('watchers')) for (const id of await this.tasksService.listWatchers(rule.workspaceId, taskId)) recipients.add(id);

    const message = fillAutomationMessage(action.message ?? '', {
      task: `#${task.number} ${task.title}`,
      status: task.status.name,
      actor: context.actorId ? (members.get(context.actorId) ?? 'Someone') : 'GitHub',
      pr: context.pr,
    });
    await this.notificationsService.send(
      [...recipients]
        .filter((userId) => members.has(userId))
        .map((recipientId) => ({
          workspaceId: rule.workspaceId,
          recipientId,
          actorId: context.actorId,
          kind: 'automation' as const,
          entityType: 'task',
          entityId: taskId,
          taskId,
          subject: message.slice(0, SUBJECT_MAX),
          excerpt: rule.name.slice(0, EXCERPT_MAX),
        })),
    );
  }
}
