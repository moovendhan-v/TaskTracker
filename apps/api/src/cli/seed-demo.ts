import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import type { TaskPriority, TaskType } from '@taskflow/shared-types';
import { AppModule } from '../app.module.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.schema.js';
import { AccessService } from '../core/access/access.service.js';
import { AuthService } from '../core/auth/auth.service.js';
import { TransactionalManager } from '../core/database/transactional-manager.js';
import { UnitOfWork } from '../core/database/unit-of-work.port.js';
import type { Actor, SessionUser, WorkspaceAccess } from '../core/http/types/authenticated-request.js';
import { CustomFieldsService } from '../modules/custom-fields/application/custom-fields.service.js';
import { CommentsService } from '../modules/comments/application/comments.service.js';
import { DocumentsService } from '../modules/documents/application/documents.service.js';
import { DepartmentsService } from '../modules/hr/departments/application/departments.service.js';
import { EmployeesService } from '../modules/hr/employees/application/employees.service.js';
import { LeaveRequestsService } from '../modules/hr/leave/application/leave-requests.service.js';
import { LeaveTypesService } from '../modules/hr/leave/application/leave-types.service.js';
import { ListsService } from '../modules/lists/application/lists.service.js';
import { MembersService } from '../modules/members/application/members.service.js';
import { RolesService } from '../modules/roles/application/roles.service.js';
import { SpacesService } from '../modules/spaces/application/spaces.service.js';
import { SprintsService } from '../modules/sprints/application/sprints.service.js';
import { StatusesService } from '../modules/statuses/application/statuses.service.js';
import { TasksService } from '../modules/tasks/application/tasks.service.js';
import { TimeTrackingService } from '../modules/time-tracking/application/time-tracking.service.js';
import { WorkspacesService } from '../modules/workspaces/application/workspaces.service.js';

const DEMO_USERS = {
  owner: { name: 'Avery Chen', email: 'avery@example.com' },
  admin: { name: 'Jordan Patel', email: 'jordan@example.com' },
  member: { name: 'Sam Rivera', email: 'sam@example.com' },
  engineer: { name: 'Kai Morgan', email: 'kai@example.com' },
} as const;

const HANDBOOK = `# Team handbook

Welcome to **Northwind Studio**. This page is demo content.

## How we work
- Plan work in two-week sprints.
- Keep tasks small enough to finish in a day or two.
- Write things down in Docs so the next person can find them.

## Time off
Request leave from **HR → Time off**. Annual leave needs approval; sick days don't.`;

/**
 * Development only: fills an empty database with a demo workspace (users,
 * spaces, lists, tasks, a running sprint, docs and HR data). Goes through the
 * same services as the API, so every rule, row-level security scope and audit
 * entry applies. Usage:
 *   SEED_PASSWORD='a long password' pnpm --filter @taskflow/api seed
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    await seed(app);
  } finally {
    await app.close();
  }
}

async function seed(app: INestApplicationContext): Promise<void> {
  const env = app.get<Env>(ENV);
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data when NODE_ENV=production.');
  const password = process.env['SEED_PASSWORD'] ?? '';
  if (password.length < 10) throw new Error('Set SEED_PASSWORD (at least 10 characters) for the demo accounts.');

  if (await userExists(app, DEMO_USERS.owner.email)) {
    console.log('Demo data is already there. Sign in as', DEMO_USERS.owner.email);
    return;
  }

  const owner = await signUp(app, DEMO_USERS.owner, password);
  const admin = await signUp(app, DEMO_USERS.admin, password);
  const member = await signUp(app, DEMO_USERS.member, password);
  const engineer = await signUp(app, DEMO_USERS.engineer, password);
  const actorOf = (user: SessionUser): Actor => ({ userId: user.id, platformRole: user.platformRole, ip: null });
  const ownerActor = actorOf(owner);

  const workspace = await app.get(WorkspacesService).create(ownerActor, { name: 'Northwind Studio', color: '#0ea5e9' });
  const workspaceId = workspace.id;
  const access = await resolveAccess(app, owner, workspaceId);

  await app.get(UnitOfWork).runInScope({ kind: 'workspace', workspaceId, userId: owner.id }, async () => {
    const roles = await app.get(RolesService).list(workspaceId);
    const roleId = (name: string) => roles.find((role) => role.name === name)?.id ?? '';
    const members = app.get(MembersService);
    await members.add(ownerActor, access, { email: admin.email, roleId: roleId('Admin') });
    await members.add(ownerActor, access, { email: member.email, roleId: roleId('Member') });
    await members.add(ownerActor, access, { email: engineer.email, roleId: roleId('Member') });

    const spaces = app.get(SpacesService);
    const lists = app.get(ListsService);
    const product = await spaces.create(ownerActor, workspaceId, { name: 'Product', color: '#6366f1' });
    const marketing = await spaces.create(ownerActor, workspaceId, { name: 'Marketing', color: '#f97316' });
    const roadmap = await lists.create(ownerActor, workspaceId, product.id, { name: 'Roadmap' });
    const bugs = await lists.create(ownerActor, workspaceId, product.id, { name: 'Bugs' });
    const campaigns = await lists.create(ownerActor, workspaceId, marketing.id, { name: 'Campaigns' });

    const tasks = app.get(TasksService);
    // Every space starts with the default statuses: To do, In progress, In review, Blocked, Done.
    const statuses = app.get(StatusesService);
    const statusIn = async (spaceId: string, name: string) => (await statuses.listForSpace(workspaceId, spaceId)).find((status) => status.name === name)?.id;
    const spaceOf = new Map([[roadmap.id, product.id], [bugs.id, product.id], [campaigns.id, marketing.id]]);
    const task = async (listId: string, title: string, status: string, priority: TaskPriority, assigneeId: string | null, dueInDays: number | null, type: TaskType = 'task') =>
      tasks.create(ownerActor, access, listId, {
        title,
        type,
        statusId: await statusIn(spaceOf.get(listId) ?? '', status),
        priority,
        assigneeId,
        startDate: dueInDays === null ? null : daysFromNow(dueInDays - 2),
        dueDate: dueInDays === null ? null : daysFromNow(dueInDays),
      });

    const onboarding = await task(roadmap.id, 'Redesign the onboarding checklist', 'In progress', 'high', admin.id, 4, 'feature');
    const sharing = await task(roadmap.id, 'Share boards with guests', 'To do', 'normal', member.id, 9, 'feature');
    const exportCsv = await task(roadmap.id, 'Export tasks to CSV', 'To do', 'low', null, null);
    await task(roadmap.id, 'Dark mode polish', 'Done', 'normal', member.id, -2);
    await task(roadmap.id, 'Public launch', 'To do', 'high', owner.id, 21, 'milestone');
    await task(bugs.id, 'Due date shows the wrong day in some time zones', 'In review', 'urgent', admin.id, 1, 'bug');
    await task(bugs.id, 'Board column scrolls the whole page', 'Blocked', 'high', null, 3, 'bug');
    await task(campaigns.id, 'Plan the spring launch email', 'To do', 'normal', owner.id, 14);
    await task(campaigns.id, 'Write the release blog post', 'In progress', 'high', owner.id, 6);
    for (const [title, status] of [['Draft the checklist copy', 'Done'], ['Review with design', 'Done'], ['Ship behind a flag', 'In progress']] as const) {
      await tasks.create(ownerActor, access, roadmap.id, { title, parentId: onboarding.id, statusId: await statusIn(product.id, status), assigneeId: admin.id });
    }

    // A client project with phases (parent tasks with subtasks), attributes and a health status.
    const portal = await spaces.create(ownerActor, workspaceId, { name: 'Client portal', color: '#14b8a6' });
    const delivery = await lists.create(ownerActor, workspaceId, portal.id, { name: 'Delivery' });
    spaceOf.set(delivery.id, portal.id);
    const phase = async (title: string, assigneeId: string, dueInDays: number, children: [string, string, number][]) => {
      const parent = await task(delivery.id, title, 'In progress', 'high', assigneeId, dueInDays, 'phase');
      for (const [childTitle, status, due] of children) {
        await tasks.create(ownerActor, access, delivery.id, {
          title: childTitle,
          parentId: parent.id,
          statusId: await statusIn(portal.id, status),
          assigneeId,
          startDate: daysFromNow(due - 3),
          dueDate: daysFromNow(due),
        });
      }
      return parent;
    };
    const discovery = await phase('Discovery and sign-off', owner.id, -6, [
      ['Stakeholder interviews', 'Done', -12],
      ['Write the scope document', 'Done', -9],
      ['Sign-off meeting', 'In review', -6],
    ]);
    const build = await phase('Build the self-service portal', engineer.id, 12, [
      ['Login with single sign-on', 'Done', -2],
      ['Invoice history page', 'In progress', 3],
      ['Support ticket form', 'To do', 8],
      ['Accessibility pass', 'To do', 11],
    ]);
    const portalTasks = [
      await task(delivery.id, 'Set up staging environment', 'Done', 'normal', engineer.id, -4),
      await task(delivery.id, 'Weekly client sync notes', 'In progress', 'normal', owner.id, -1),
      await task(delivery.id, 'Fix session timeout on mobile', 'Blocked', 'urgent', engineer.id, -3, 'bug'),
      await task(delivery.id, 'Load test the invoice API', 'To do', 'high', engineer.id, 5),
      await task(delivery.id, 'Draft the cutover plan', 'To do', 'normal', admin.id, 15),
    ];
    await spaces.update(ownerActor, workspaceId, portal.id, {
      status: 'at_risk',
      statusNote: 'The mobile session bug blocks the beta. Kai is on it; cutover moves a week if it is not fixed by Friday.',
      startDate: daysFromNow(-20),
      dueDate: daysFromNow(30),
    });
    await spaces.update(ownerActor, workspaceId, product.id, { status: 'on_track', statusNote: 'Sprint 12 is on schedule for the onboarding release.' });
    const fields = app.get(CustomFieldsService);
    const clientField = await fields.create(ownerActor, workspaceId, { name: 'Client name', type: 'text', entity: 'space', required: true });
    const contractField = await fields.create(ownerActor, workspaceId, {
      name: 'Contract type',
      type: 'select',
      entity: 'space',
      options: [{ id: 'fixed', label: 'Fixed price' }, { id: 'tm', label: 'Time and materials' }],
    });
    const regionField = await fields.create(ownerActor, workspaceId, { name: 'Region', type: 'text', entity: 'space' });
    const sowField = await fields.create(ownerActor, workspaceId, { name: 'SoW reference', type: 'url', entity: 'space' });
    await fields.updateSpaceValues(ownerActor, workspaceId, portal.id, {
      [clientField.id]: 'Harbor Health',
      [contractField.id]: 'fixed',
      [regionField.id]: 'Europe',
      [sowField.id]: 'https://example.com/contracts/harbor-health-sow',
    });

    // Two weeks of logged time, so timesheets, reports and dashboards have something to show.
    const time = app.get(TimeTrackingService);
    const work: [SessionUser, string, string][] = [
      [engineer, build.id, 'Built the invoice history API and paging'],
      [engineer, portalTasks[2]!.id, 'Reproduced the timeout on iOS, traced it to the refresh token'],
      [engineer, portalTasks[3]!.id, 'Wrote k6 scripts for the invoice endpoints'],
      [owner, portalTasks[1]!.id, 'Client sync: agreed the beta scope'],
      [owner, discovery.id, 'Prepared the sign-off deck'],
      [admin, onboarding.id, 'Reviewed checklist copy with design'],
      [admin, sharing.id, 'Spike on guest permissions'],
      [member, onboarding.id, 'Onboarding illustrations'],
    ];
    for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
      const day = new Date(Date.now() - daysAgo * 86_400_000);
      if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
      for (const [index, [user, taskId, note]] of work.entries()) {
        if ((index + daysAgo) % 3 === 0) continue;
        const startHour = 8 + ((index * 2 + daysAgo) % 6);
        const minutes = [60, 90, 120, 150, 180][(index + daysAgo) % 5] ?? 60;
        const startedAt = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), startHour, 0));
        await time.log(actorOf(user), access, {
          taskId,
          startedAt: startedAt.toISOString(),
          endedAt: new Date(startedAt.getTime() + minutes * 60_000).toISOString(),
          note,
          activity: user.id === owner.id ? 'Management' : 'Development',
        });
      }
    }

    await app.get(CommentsService).create(actorOf(admin), workspaceId, onboarding.id, {
      body: 'First draft is in the doc. Feedback welcome before Thursday.',
    });

    const sprints = app.get(SprintsService);
    const sprint = await sprints.create(ownerActor, workspaceId, product.id, {
      name: 'Sprint 12',
      goal: 'Smoother onboarding',
      startDate: daysFromNow(-3).slice(0, 10),
      endDate: daysFromNow(11).slice(0, 10),
    });
    for (const planned of [onboarding, sharing, exportCsv]) await tasks.update(ownerActor, access, planned.id, { sprintId: sprint.id });
    await sprints.start(ownerActor, workspaceId, sprint.id);

    const documents = app.get(DocumentsService);
    const handbook = await documents.create(ownerActor, workspaceId, { title: 'Team handbook', content: HANDBOOK });
    await documents.create(ownerActor, workspaceId, {
      title: 'Your first week',
      parentId: handbook.id,
      content: '## Day one\n- Set up your account\n- Say hello in the team space\n- Pick up a task marked **good first task**',
    });
    await documents.create(ownerActor, workspaceId, {
      title: 'Release process',
      spaceId: product.id,
      content: '1. Freeze the sprint\n2. Run the checks\n3. Write the release notes\n4. Ship',
    });

    const departments = app.get(DepartmentsService);
    const engineering = await departments.create(ownerActor, workspaceId, { name: 'Engineering', headUserId: admin.id });
    await departments.create(ownerActor, workspaceId, { name: 'Marketing', headUserId: owner.id });
    const employees = app.get(EmployeesService);
    await employees.upsert(ownerActor, workspaceId, admin.id, {
      jobTitle: 'Engineering lead',
      departmentId: engineering.id,
      managerUserId: owner.id,
      employmentType: 'full_time',
      startDate: '2025-03-03',
    });
    await employees.upsert(ownerActor, workspaceId, member.id, {
      jobTitle: 'Product designer',
      departmentId: engineering.id,
      managerUserId: admin.id,
      employmentType: 'full_time',
      startDate: '2026-02-09',
    });

    const leaveTypes = app.get(LeaveTypesService);
    const annual = await leaveTypes.create(ownerActor, workspaceId, { name: 'Annual leave', color: '#22c55e', annualAllowanceDays: 20 });
    await leaveTypes.create(ownerActor, workspaceId, { name: 'Sick leave', color: '#ef4444', annualAllowanceDays: null, requiresApproval: false });
    await app.get(LeaveRequestsService).request(actorOf(member), workspaceId, {
      leaveTypeId: annual.id,
      startDate: nextWeekday(21),
      endDate: nextWeekday(21),
      reason: 'Family visit',
    });
  });

  console.log(`Seeded "Northwind Studio". Sign in as ${Object.values(DEMO_USERS).map((user) => user.email).join(', ')} with SEED_PASSWORD.`);
}

async function userExists(app: INestApplicationContext, email: string): Promise<boolean> {
  // Better Auth's "user" table has no row-level security, so no scope is needed.
  const rows: unknown[] = await app.get(TransactionalManager).manager.query('SELECT 1 FROM "user" WHERE LOWER(email) = LOWER($1)', [email]);
  return rows.length > 0;
}

async function signUp(app: INestApplicationContext, user: { name: string; email: string }, password: string): Promise<SessionUser> {
  const { user: created } = await app.get(AuthService).auth.api.signUpEmail({ body: { ...user, password } });
  // Demo addresses can't receive mail, so mark them confirmed directly (development only, see the
  // production check above). Better Auth's "user" table has no row-level security.
  await app.get(TransactionalManager).manager.query('UPDATE "user" SET "emailVerified" = true WHERE id = $1', [created.id]);
  return { id: created.id, email: created.email, name: created.name, image: null, platformRole: 'USER', emailVerified: true };
}

async function resolveAccess(app: INestApplicationContext, user: SessionUser, workspaceId: string): Promise<WorkspaceAccess> {
  const access = await app.get(AccessService).resolve(user, workspaceId);
  if (!access) throw new Error('The demo owner has no access to the new workspace');
  return access;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** A weekday about `days` from now, as yyyy-mm-dd. */
function nextWeekday(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

main().catch((error: unknown) => {
  console.error('Seeding failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
