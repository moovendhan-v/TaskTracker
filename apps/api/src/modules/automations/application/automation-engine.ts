import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  addDays,
  canInSpace,
  continuationAfter,
  describeWait,
  evaluateCondition,
  AUTOMATION_LIMITS,
  fillAutomationMessage,
  flowActions,
  flowFromRule,
  type AutomationAction,
  type AutomationFlow,
  type AutomationTriggerType,
  type FlowStep,
  type FlowTaskFacts,
  type FlowTraceEntry,
  type FlowWaitStep,
  type TaskResponse,
} from '@taskflow/shared-types';
import { AccessService } from '../../../core/access/access.service.js';
import { TransactionalManager } from '../../../core/database/transactional-manager.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { DomainEvent } from '../../../core/events/domain-event.js';
import { EventBus } from '../../../core/events/event-bus.port.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { Clock } from '../../../core/time/clock.port.js';
import { ChatService } from '../../chat/application/chat.service.js';
import { CommentsService } from '../../comments/application/comments.service.js';
import { MembersService } from '../../members/application/members.service.js';
import { NotificationsService } from '../../notifications/application/notifications.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import type { AutomationJob, AutomationRule } from '../domain/automation-rule.js';
import { AutomationPolicy } from '../domain/automation.policy.js';
import { AutomationRepository } from '../domain/automation.repository.js';

/** What else a run knows about why it happened. */
export interface RunContext {
  /** Who made the change; null for outside events such as a GitHub webhook. */
  actorId: string | null;
  /** A pull request, for GitHub triggers: "Fix login (#42)". */
  pr?: string;
  /** The sprint's name, for sprint triggers ({{sprint}}). */
  sprint?: string;
  /** Webhook calls this run queued, linked to the run once it's recorded. */
  queued?: string[];
}

/** Where a walk through steps ended. */
type StepsEnd = { end: 'done' } | { end: 'stopped' } | { end: 'wait'; step: FlowWaitStep };

/** Picks a run back up after a wait: the steps left, the path so far, and the run to update. */
interface Resume {
  steps: FlowStep[];
  trace: FlowTraceEntry[];
  runId: string | null;
}

/** Fingerprint of a flow, so a paused run only resumes in the flow it paused in. */
export function flowHash(flow: AutomationFlow): string {
  return createHash('sha256').update(JSON.stringify(flow)).digest('hex');
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
    private readonly chatService: ChatService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe((event) => this.handle(event));
  }

  private async handle(event: DomainEvent): Promise<void> {
    if (AutomationEngine.running.getStore()) return;
    if (event.entityType === 'sprint' && event.facts?.sprintTransition && event.facts.spaceId) {
      return this.runForSprint(event.workspaceId, event.facts.spaceId, event.entityId, event.facts.sprintTransition, { actorId: event.actorId, sprint: event.facts.title ?? '' });
    }
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

  /**
   * A sprint started or was completed: every enabled rule of its space listening
   * for that runs once for each task in the sprint (those in it at the start, or
   * those it held when it completed), up to AUTOMATION_LIMITS.tasksPerRun. A fire
   * key per sprint keeps each task to one run, even if the event came twice.
   */
  private async runForSprint(workspaceId: string, spaceId: string, sprintId: string, transition: 'started' | 'completed', context: RunContext): Promise<void> {
    const trigger: AutomationTriggerType = transition === 'started' ? 'sprint_started' : 'sprint_completed';
    const rules = (await this.automations.listEnabledFor(workspaceId, [trigger])).filter((rule) => rule.spaceId === spaceId);
    if (rules.length === 0) return;
    const taskIds = await this.automations.sprintTaskIds(workspaceId, sprintId, transition === 'started' ? 'start' : 'end', AUTOMATION_LIMITS.tasksPerRun);
    for (const rule of rules) {
      for (const taskId of taskIds) {
        // Fire keys hold 40 characters: a short prefix and the sprint id without dashes.
        if (!(await this.automations.claimFire(workspaceId, rule.id, taskId, `${transition === 'started' ? 'ss' : 'sc'}:${sprintId.replace(/-/g, '')}`))) continue;
        let task: TaskResponse;
        try {
          task = await this.tasksService.get(workspaceId, taskId);
        } catch (error) {
          if (error instanceof DomainError) continue;
          throw error;
        }
        if (task.spaceId !== rule.spaceId) continue;
        const facts = { listId: task.listId, statusId: task.statusId, statusCategory: task.status.category, priority: task.priority, type: task.type };
        if (!AutomationPolicy.matches(rule, trigger, facts)) continue;
        await this.execute(rule, task, context);
      }
    }
  }

  /**
   * Fires one scheduled rule (due soon, overdue) for one task. The scheduler has
   * already made sure this is the first fire for the task's due date.
   */
  async runScheduled(rule: AutomationRule, taskId: string): Promise<void> {
    if (AutomationEngine.running.getStore()) return;
    let task: TaskResponse;
    try {
      task = await this.tasksService.get(rule.workspaceId, taskId);
    } catch (error) {
      if (error instanceof DomainError) return;
      throw error;
    }
    if (task.spaceId !== rule.spaceId) return;
    const facts = { listId: task.listId, statusId: task.statusId, statusCategory: task.status.category, priority: task.priority, type: task.type };
    if (!AutomationPolicy.matches(rule, rule.triggerType, facts)) return;
    await this.execute(rule, task, { actorId: null });
  }

  /**
   * Carries on a run that reached a wait step, with the rule's owner's access as
   * it is now. Dropped (and the run marked skipped) if the rule was turned off or
   * its flow changed while waiting.
   */
  async resume(job: AutomationJob): Promise<void> {
    if (AutomationEngine.running.getStore()) return;
    const run = job.runId ? await this.automations.findRun(job.workspaceId, job.runId) : null;
    const trace = run?.trace ?? [];
    const skip = (message: string) =>
      this.automations.recordRun({ workspaceId: job.workspaceId, ruleId: job.ruleId, taskId: job.taskId, status: 'skipped', message, trace }, job.runId);

    const rule = await this.automations.findInWorkspace(job.workspaceId, job.ruleId);
    if (!rule) return;
    const flow = rule.flow ?? flowFromRule(rule.conditions, rule.actions);
    const steps = continuationAfter(flow.steps, job.stepId);
    if (!rule.enabled) return void (await skip('The automation was turned off while this run was waiting'));
    if (flowHash(flow) !== job.flowHash || !steps) return void (await skip('The automation was changed while this run was waiting'));
    let task: TaskResponse;
    try {
      task = await this.tasksService.get(job.workspaceId, job.taskId);
    } catch (error) {
      if (error instanceof DomainError) return void (await skip('The task is gone'));
      throw error;
    }
    // The rule only acts in its own space; a task moved elsewhere while waiting is left alone.
    if (task.spaceId !== rule.spaceId) return void (await skip('The task moved to another project while this run was waiting'));
    await this.execute(rule, task, job.context, { steps, trace: [...trace], runId: job.runId });
  }

  private async execute(rule: AutomationRule, task: TaskResponse, given: RunContext, resume?: Resume): Promise<void> {
    const context: RunContext = { ...given, queued: [] };
    const flow = rule.flow ?? flowFromRule(rule.conditions, rule.actions);
    const trace: FlowTraceEntry[] = resume?.trace ?? [];
    const record = (status: 'succeeded' | 'failed' | 'skipped' | 'waiting', message: string, resumesAt: Date | null = null) =>
      this.automations.recordRun(
        { workspaceId: rule.workspaceId, ruleId: rule.id, taskId: task.id, status, message: message.slice(0, 300), trace: trace.slice(0, TRACE_MAX), resumesAt },
        resume?.runId,
      );

    const access = rule.createdById ? await this.accessService.resolveMember(rule.createdById, rule.workspaceId) : null;
    if (!rule.createdById || !access) return void (await record('skipped', 'The person this automation runs as is no longer in the workspace'));
    const missing = ['task.view' as const, ...AutomationPolicy.requiredPermissions(flowActions(flow))].filter((permission) => !canInSpace(access, rule.spaceId, permission));
    if (missing.length) return void (await record('skipped', `The person this automation runs as no longer has ${missing.join(', ')} here`));

    const actor: Actor = { userId: rule.createdById, platformRole: 'USER', ip: null };
    try {
      const ended = await this.transactional.savepoint(() =>
        this.transactional.runInScope({ kind: 'workspace', workspaceId: rule.workspaceId, userId: actor.userId, spaceRules: access.spaceRules }, () =>
          AutomationEngine.running.run(true, () => this.runSteps(resume?.steps ?? flow.steps, rule, actor, access, task.id, context, trace)),
        ),
      );
      if (ended.end === 'wait') {
        // What ran before the wait is kept; the rest runs when the scheduler picks the job up.
        const runAt = new Date(this.clock.now().getTime() + ended.step.minutes * 60_000);
        const runId = await record('waiting', `Waiting ${describeWait(ended.step.minutes)}`, runAt);
        await this.automations.attachWebhooks(rule.workspaceId, context.queued ?? [], runId);
        await this.automations.scheduleJob({
          workspaceId: rule.workspaceId,
          ruleId: rule.id,
          taskId: task.id,
          runId,
          stepId: ended.step.id,
          flowHash: flowHash(flow),
          context: { actorId: context.actorId, ...(context.pr ? { pr: context.pr.slice(0, 300) } : {}), ...(context.sprint ? { sprint: context.sprint.slice(0, 80) } : {}) },
          runAt,
        });
      } else {
        const runId = await record('succeeded', '');
        await this.automations.attachWebhooks(rule.workspaceId, context.queued ?? [], runId);
      }
    } catch (error) {
      // Domain errors explain themselves; anything else stays in the server log. The savepoint undid every step.
      const message = error instanceof DomainError ? error.message : 'Something went wrong';
      const failed = trace[trace.length - 1];
      if (failed && failed.outcome === 'ran') trace[trace.length - 1] = { ...failed, outcome: 'failed', detail: message.slice(0, 200) };
      await record('failed', `${message} ${resume ? 'Nothing after the wait was changed.' : 'Nothing was changed.'}`);
      if (!(error instanceof DomainError)) this.logger.error(`Automation ${rule.id} failed`, error instanceof Error ? error.stack : undefined);
    }
    if (!resume) await this.automations.markRun(rule.workspaceId, rule.id, this.clock.now());
  }

  /**
   * Walks the steps in order. If-steps look at the task as it is at that moment,
   * so an earlier step's change counts. Ends early at a stop or a wait.
   */
  private async runSteps(steps: readonly FlowStep[], rule: AutomationRule, actor: Actor, access: WorkspaceAccess, taskId: string, context: RunContext, trace: FlowTraceEntry[]): Promise<StepsEnd> {
    for (const step of steps) {
      if (step.kind === 'stop') {
        trace.push({ stepId: step.id, outcome: 'stopped', detail: '' });
        return { end: 'stopped' };
      }
      if (step.kind === 'wait') {
        trace.push({ stepId: step.id, outcome: 'waited', detail: describeWait(step.minutes) });
        return { end: 'wait', step };
      }
      if (step.kind === 'if') {
        const holds = evaluateCondition(step.condition, await this.factsOf(rule.workspaceId, taskId), this.clock.now().toISOString().slice(0, 10));
        trace.push({ stepId: step.id, outcome: holds ? 'took-yes' : 'took-no', detail: '' });
        const inner = await this.runSteps(holds ? step.yes : step.no, rule, actor, access, taskId, context, trace);
        if (inner.end !== 'done') return inner;
        continue;
      }
      // Marked as ran first: if the action throws, execute() turns this entry into the failure.
      const entry: FlowTraceEntry = { stepId: step.id, outcome: 'ran', detail: step.action.type === 'webhook' ? 'Queued to send' : '' };
      trace.push(entry);
      const detail = await this.applyAction(step.action, rule, actor, access, taskId, context, step.id);
      if (detail) entry.detail = detail;
    }
    return { end: 'done' };
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

  /** Runs one action; may return a note for the run's trace. */
  private async applyAction(action: AutomationAction, rule: AutomationRule, actor: Actor, access: WorkspaceAccess, taskId: string, context: RunContext, stepId: string): Promise<string | void> {
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
        const body = fillAutomationMessage(action.message ?? '', { task: `#${task.number} ${task.title}`, status: task.status.name, actor: 'Automation', pr: context.pr, sprint: context.sprint });
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
      case 'post_chat': {
        // Posts as the rule's owner, with their channel access as it is now.
        const task = await this.tasksService.get(rule.workspaceId, taskId);
        const body = fillAutomationMessage(action.message ?? '', { task: `#${task.number} ${task.title}`, status: task.status.name, actor: 'Automation', pr: context.pr, sprint: context.sprint });
        await this.chatService.send(actor, access, { channelId: action.channelId as string, body });
        return;
      }
      case 'move_to_list': {
        // Lists were checked against the rule's space when it was saved; the task
        // service checks again (same space, task.update) with the owner's access now.
        const { moved } = await this.tasksService.moveToList(actor, access, taskId, action.listId as string);
        return moved ? undefined : 'Already in that list';
      }
      case 'webhook': {
        // Queued, not sent: the scheduler calls it after this transaction commits, outside it.
        const task = await this.tasksService.get(rule.workspaceId, taskId);
        const body = JSON.stringify({
          event: 'automation.webhook',
          workspaceId: rule.workspaceId,
          automation: { id: rule.id, name: rule.name, trigger: rule.triggerType },
          task: { id: task.id, number: task.number, title: task.title, status: task.status.name, statusCategory: task.status.category, priority: task.priority, dueDate: task.dueDate, spaceId: task.spaceId },
          ...(context.pr ? { pullRequest: context.pr } : {}),
          queuedAt: this.clock.now().toISOString(),
        });
        context.queued?.push(await this.automations.queueWebhook({ workspaceId: rule.workspaceId, ruleId: rule.id, stepId, url: action.url as string, body }));
        return;
      }
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
      sprint: context.sprint,
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
