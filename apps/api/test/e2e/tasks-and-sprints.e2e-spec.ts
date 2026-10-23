import { beforeAll, describe, expect, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';

const TASK_FIELDS = 'id title status priority assigneeId sprintId position';

interface Task {
  id: string;
  title: string;
  status: string;
  assigneeId: string | null;
  sprintId: string | null;
  position: number;
}

describe('tasks, comments and sprints', () => {
  let ws: WorkspaceFixture;
  let member: TestUser;
  let taskId: string;
  const vars = (extra: Record<string, unknown> = {}) => ({ w: ws.workspaceId, ...extra });

  beforeAll(async () => {
    ws = await createWorkspace('Owner');
    member = await TestUser.signUp('Member');
    await addMember(ws, member, 'Member');
  });

  describe('tasks', () => {
    it('creates a task at the end of its column', async () => {
      const { createTask } = await ws.owner.data<{ createTask: Task }>(
        `mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Set up CI", priority: high }) { ${TASK_FIELDS} } }`,
        vars({ l: ws.listId }),
      );
      expect(createTask).toMatchObject({ title: 'Set up CI', status: 'todo', position: 1024 });
      taskId = createTask.id;
    });

    it('searches and pages', async () => {
      const { tasks } = await ws.owner.data<{ tasks: { total: number; items: Task[] } }>(
        'query($w: ID!, $l: ID!) { tasks(workspaceId: $w, listId: $l, search: "ci", pageSize: 10) { total items { id } } }',
        vars({ l: ws.listId }),
      );
      expect(tasks.total).toBe(1);
    });

    it('caps the page size', async () => {
      const result = await ws.owner.error('query($w: ID!, $l: ID!) { tasks(workspaceId: $w, listId: $l, pageSize: 1000) { total } }', vars({ l: ws.listId }));
      expect(result.code).toBe('BAD_USER_INPUT');
    });

    it('validates input: unknown fields, bad enums, long titles and null for required fields', async () => {
      const create = 'mutation($w: ID!, $l: ID!, $input: CreateTaskInput!) { createTask(workspaceId: $w, listId: $l, input: $input) { id } }';
      expect((await ws.owner.gql(create, vars({ l: ws.listId, input: { title: 'x', createdById: 'me' } }))).errors?.[0]?.message).toMatch(/createdById/);
      expect((await ws.owner.gql(create, vars({ l: ws.listId, input: { title: 'x', status: 'archived' } }))).errors).toBeDefined();
      expect((await ws.owner.error(create, vars({ l: ws.listId, input: { title: 'x'.repeat(201) } }))).code).toBe('BAD_USER_INPUT');
      const update = 'mutation($w: ID!, $t: ID!, $input: UpdateTaskInput!) { updateTask(workspaceId: $w, taskId: $t, input: $input) { id } }';
      expect((await ws.owner.error(update, vars({ t: taskId, input: { title: null } }))).code).toBe('BAD_USER_INPUT');
    });

    it('lets members create tasks but not delete them', async () => {
      const { createTask } = await member.data<{ createTask: Task }>(
        'mutation($w: ID!, $l: ID!) { createTask(workspaceId: $w, listId: $l, input: { title: "Member task" }) { id title } }',
        vars({ l: ws.listId }),
      );
      expect(createTask.title).toBe('Member task');
      expect((await member.error('mutation($w: ID!, $t: ID!) { deleteTask(workspaceId: $w, taskId: $t) }', vars({ t: taskId }))).code).toBe('FORBIDDEN');
    });

    it('assigns only to workspace members', async () => {
      const update = `mutation($w: ID!, $t: ID!, $input: UpdateTaskInput!) { updateTask(workspaceId: $w, taskId: $t, input: $input) { ${TASK_FIELDS} } }`;
      const { updateTask } = await ws.owner.data<{ updateTask: Task }>(update, vars({ t: taskId, input: { assigneeId: member.id, status: 'in_progress' } }));
      expect(updateTask).toMatchObject({ assigneeId: member.id, status: 'in_progress' });
      const stranger = await TestUser.signUp('Stranger');
      expect((await ws.owner.error(update, vars({ t: taskId, input: { assigneeId: stranger.id } }))).message).toMatch(/must be a member/);
    });
  });

  describe('comments', () => {
    let commentId: string;
    const fields = 'id body authorName';

    it('stores comment text as plain text', async () => {
      const { createComment } = await member.data<{ createComment: { id: string; body: string } }>(
        `mutation($w: ID!, $t: ID!) { createComment(workspaceId: $w, taskId: $t, input: { body: "<b>raw</b> text" }) { ${fields} } }`,
        vars({ t: taskId }),
      );
      expect(createComment.body).toBe('<b>raw</b> text');
      commentId = createComment.id;
    });

    it('lists comments with author names', async () => {
      const { comments } = await ws.owner.data<{ comments: { authorName: string }[] }>(
        `query($w: ID!, $t: ID!) { comments(workspaceId: $w, taskId: $t) { ${fields} } }`,
        vars({ t: taskId }),
      );
      expect(comments.map((comment) => comment.authorName)).toEqual(['Member']);
    });

    it('lets only the author edit, and owners delete', async () => {
      const edit = 'mutation($w: ID!, $c: ID!, $body: String!) { updateComment(workspaceId: $w, commentId: $c, input: { body: $body }) { body } }';
      expect((await ws.owner.error(edit, vars({ c: commentId, body: 'x' }))).message).toMatch(/Only the author/);
      expect((await member.data<{ updateComment: { body: string } }>(edit, vars({ c: commentId, body: 'edited' }))).updateComment.body).toBe('edited');
      const { deleteComment } = await ws.owner.data<{ deleteComment: boolean }>(
        'mutation($w: ID!, $c: ID!) { deleteComment(workspaceId: $w, commentId: $c) }',
        vars({ c: commentId }),
      );
      expect(deleteComment).toBe(true);
    });
  });

  describe('sprints', () => {
    let sprint1: string;
    let sprint2: string;
    const create = 'mutation($w: ID!, $s: ID!, $input: CreateSprintInput!) { createSprint(workspaceId: $w, spaceId: $s, input: $input) { id status } }';
    const plan = 'mutation($w: ID!, $t: ID!, $sprint: ID) { updateTask(workspaceId: $w, taskId: $t, input: { sprintId: $sprint }) { sprintId } }';

    it('creates sprints and rejects reversed dates', async () => {
      const first = await ws.owner.data<{ createSprint: { id: string; status: string } }>(
        create,
        vars({ s: ws.spaceId, input: { name: 'Sprint 1', goal: 'Ship CI', startDate: '2026-11-02', endDate: '2026-11-13' } }),
      );
      expect(first.createSprint.status).toBe('planned');
      sprint1 = first.createSprint.id;
      sprint2 = (
        await ws.owner.data<{ createSprint: { id: string } }>(create, vars({ s: ws.spaceId, input: { name: 'Sprint 2', startDate: '2026-11-16', endDate: '2026-11-27' } }))
      ).createSprint.id;
      const reversed = await ws.owner.error(create, vars({ s: ws.spaceId, input: { name: 'Bad', startDate: '2026-11-13', endDate: '2026-11-02' } }));
      expect(reversed.message).toMatch(/on or after/);
    });

    it('needs sprint.manage to plan work', async () => {
      expect((await member.error(plan, vars({ t: taskId, sprint: sprint1 }))).message).toMatch(/sprint\.manage/);
      expect((await ws.owner.data<{ updateTask: { sprintId: string } }>(plan, vars({ t: taskId, sprint: sprint1 }))).updateTask.sprintId).toBe(sprint1);
    });

    it('shows planned tasks in the sprint, not the backlog', async () => {
      const { sprintTasks } = await ws.owner.data<{ sprintTasks: { id: string }[] }>(
        'query($w: ID!, $s: ID!) { sprintTasks(workspaceId: $w, sprintId: $s) { id } }',
        vars({ s: sprint1 }),
      );
      expect(sprintTasks.map((task) => task.id)).toContain(taskId);
      const { backlog } = await ws.owner.data<{ backlog: { id: string }[] }>('query($w: ID!, $s: ID!) { backlog(workspaceId: $w, spaceId: $s) { id } }', vars({ s: ws.spaceId }));
      expect(backlog.map((task) => task.id)).not.toContain(taskId);
    });

    it('runs one active sprint per space and only deletes planned sprints', async () => {
      const start = 'mutation($w: ID!, $s: ID!) { startSprint(workspaceId: $w, sprintId: $s) { status } }';
      expect((await ws.owner.data<{ startSprint: { status: string } }>(start, vars({ s: sprint1 }))).startSprint.status).toBe('active');
      expect((await ws.owner.error(start, vars({ s: sprint2 }))).message).toMatch(/Finish the active sprint/);
      expect((await ws.owner.error('mutation($w: ID!, $s: ID!) { deleteSprint(workspaceId: $w, sprintId: $s) }', vars({ s: sprint1 }))).message).toMatch(/Only planned/);
    });

    it('rolls unfinished tasks into the next sprint on completion', async () => {
      const complete = 'mutation($w: ID!, $s: ID!, $next: ID) { completeSprint(workspaceId: $w, sprintId: $s, moveOpenTasksToSprintId: $next) { status } }';
      expect((await ws.owner.data<{ completeSprint: { status: string } }>(complete, vars({ s: sprint1, next: sprint2 }))).completeSprint.status).toBe('completed');
      const { task } = await ws.owner.data<{ task: Task }>('query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { sprintId } }', vars({ t: taskId }));
      expect(task.sprintId).toBe(sprint2);
      const { sprints } = await ws.owner.data<{ sprints: { id: string; totalTasks: number }[] }>(
        'query($w: ID!, $s: ID!) { sprints(workspaceId: $w, spaceId: $s) { id totalTasks } }',
        vars({ s: ws.spaceId }),
      );
      expect(sprints.find((sprint) => sprint.id === sprint2)?.totalTasks).toBe(1);
      const frozen = await ws.owner.error('mutation($w: ID!, $s: ID!) { updateSprint(workspaceId: $w, sprintId: $s, input: { name: "x" }) { id } }', vars({ s: sprint1 }));
      expect(frozen.message).toMatch(/completed sprint/);
    });

    it('completes a sprint into the backlog when no target is given (null)', async () => {
      const startAgain = await ws.owner.data<{ startSprint: { status: string } }>('mutation($w: ID!, $s: ID!) { startSprint(workspaceId: $w, sprintId: $s) { status } }', vars({ s: sprint2 }));
      expect(startAgain.startSprint.status).toBe('active');
      await ws.owner.data('mutation($w: ID!, $s: ID!) { completeSprint(workspaceId: $w, sprintId: $s, moveOpenTasksToSprintId: null) { status } }', vars({ s: sprint2 }));
      const { task } = await ws.owner.data<{ task: Task }>('query($w: ID!, $t: ID!) { task(workspaceId: $w, taskId: $t) { sprintId } }', vars({ t: taskId }));
      expect(task.sprintId).toBeNull();
    });
  });
});
