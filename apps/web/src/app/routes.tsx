import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import { PreferencesEffects } from '@/core/preferences/preferences-effects';
import { preferencesQuery } from '@/core/preferences/use-preferences';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { fetchCurrentUser } from '@/core/api/current-user.api';
import { hasSession } from '@/core/auth/session';
import { queryKeys } from '@/lib/query-keys';
import { AdminAuditLogPage, AdminLayout, AdminUsersPage, AdminWorkspacesPage } from '@/modules/admin';
import { WorkspaceAuditLogPage } from '@/modules/audit-log';
import { ForgotPasswordPage, ResetPasswordPage, SignInPage, SignUpPage } from '@/modules/auth';
import { DocumentsPage } from '@/modules/documents';
import { ChatPage } from '@/modules/chat';
import { HomePage } from '@/modules/dashboard';
import { ApprovalsPage, DepartmentsPage, DirectoryPage, LeaveTypesPage, TimeOffPage } from '@/modules/hr';
import { listsApi } from '@/modules/lists';
import { InboxPage } from '@/modules/inbox';
import { AppearancePage } from '@/modules/preferences';
import { tasksApi } from '@/modules/tasks';
import { MembersPage } from '@/modules/members';
import { isProjectView, MyTasksPage, ProjectPage } from '@/modules/projects';
import { RolesPage } from '@/modules/roles';
import { SprintBoardPage } from '@/modules/sprints';
import { DailyLogPage, TimesheetsPage } from '@/modules/time';
import { preferencesQuery as preferences } from '@/core/preferences/use-preferences';
import { OnboardingPage, useWorkspaceUiStore, WorkspaceSettingsPage, workspacesApi } from '@/modules/workspaces';
import { WorkspaceLayout } from './layouts/workspace-layout';

interface RouterContext {
  queryClient: QueryClient;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
  pendingComponent: FullPageSpinner,
});

/* Public pages: signed-in users are sent into the app. */
const publicLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'public',
  beforeLoad: async ({ location, context }) => {
    if (location.pathname !== '/reset-password' && (await hasSession(context.queryClient))) throw redirect({ to: '/' });
  },
  component: Outlet,
});

const signInRoute = createRoute({ getParentRoute: () => publicLayout, path: '/sign-in', component: SignInPage });
const signUpRoute = createRoute({ getParentRoute: () => publicLayout, path: '/sign-up', component: SignUpPage });
const forgotPasswordRoute = createRoute({ getParentRoute: () => publicLayout, path: '/forgot-password', component: ForgotPasswordPage });
const resetPasswordRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/reset-password',
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' && search.token.length <= 256 ? search.token : undefined,
  }),
  component: function ResetPasswordRoute() {
    const { token } = resetPasswordRoute.useSearch();
    return <ResetPasswordPage token={token} />;
  },
});

/* Everything below needs a session. The API checks again on every request. */
const appLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context }) => {
    if (!(await hasSession(context.queryClient))) throw redirect({ to: '/sign-in' });
    // Preferences shape the whole layout, so load them with the session rather than after first paint.
    await context.queryClient.prefetchQuery(preferencesQuery);
  },
  component: function AppLayout() {
    return (
      <>
        <PreferencesEffects />
        <Outlet />
      </>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/',
  beforeLoad: async ({ context }) => {
    const workspaces = await context.queryClient.ensureQueryData({ queryKey: queryKeys.workspaces, queryFn: workspacesApi.list });
    const last = useWorkspaceUiStore.getState().lastWorkspaceId;
    const target = workspaces.find((workspace) => workspace.id === last) ?? workspaces[0];
    if (!target) throw redirect({ to: '/onboarding' });
    throw redirect({ to: '/w/$workspaceId', params: { workspaceId: target.id } });
  },
});

const onboardingRoute = createRoute({ getParentRoute: () => appLayout, path: '/onboarding', component: OnboardingPage });

/* Platform admin console. Hidden from other users here; enforced by the API (404 for non-admins). */
const adminRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/admin',
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData({ queryKey: queryKeys.me, queryFn: fetchCurrentUser });
    if (me.platformRole !== 'SUPER_ADMIN') throw redirect({ to: '/' });
  },
  component: AdminLayout,
});
const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/admin/users' });
  },
});
const adminUsersRoute = createRoute({ getParentRoute: () => adminRoute, path: '/users', component: AdminUsersPage });
const adminWorkspacesRoute = createRoute({ getParentRoute: () => adminRoute, path: '/workspaces', component: AdminWorkspacesPage });
const adminAuditRoute = createRoute({ getParentRoute: () => adminRoute, path: '/audit-log', component: AdminAuditLogPage });

/** `?task=<id>` opens a task over any workspace page. */
const taskSearch = (search: Record<string, unknown>): { task?: string } => ({
  task: typeof search.task === 'string' && UUID.test(search.task) ? search.task : undefined,
});

const workspaceRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/w/$workspaceId',
  validateSearch: taskSearch,
  beforeLoad: async ({ context, params }) => {
    if (!UUID.test(params.workspaceId)) throw redirect({ to: '/' });
    try {
      await context.queryClient.ensureQueryData({
        queryKey: queryKeys.workspace(params.workspaceId),
        queryFn: () => workspacesApi.get(params.workspaceId),
      });
    } catch {
      useWorkspaceUiStore.getState().setLastWorkspaceId(null);
      throw redirect({ to: '/' });
    }
    useWorkspaceUiStore.getState().setLastWorkspaceId(params.workspaceId);
  },
  component: function WorkspaceRoute() {
    const { workspaceId } = workspaceRoute.useParams();
    const { task } = workspaceRoute.useSearch();
    return <WorkspaceLayout workspaceId={workspaceId} openTaskId={task} />;
  },
});

const workspaceHomeRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/',
  component: function WorkspaceHomeRoute() {
    const { workspaceId } = workspaceRoute.useParams();
    return <HomePage workspaceId={workspaceId} />;
  },
});

/** Old list links open the list's project, narrowed to that list. */
const listRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/l/$listId',
  beforeLoad: async ({ context, params, search }) => {
    const lists = await context.queryClient.ensureQueryData({ queryKey: queryKeys.lists(params.workspaceId), queryFn: () => listsApi.list(params.workspaceId) });
    const list = lists.find((item) => item.id === params.listId);
    if (!list) throw redirect({ to: '/w/$workspaceId', params: { workspaceId: params.workspaceId } });
    const { defaultTaskView } = await context.queryClient.ensureQueryData(preferences);
    throw redirect({ to: '/w/$workspaceId/p/$spaceId/$view', params: { workspaceId: params.workspaceId, spaceId: list.spaceId, view: defaultTaskView }, search: { list: list.id, task: search.task } });
  },
});

const projectRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/p/$spaceId/$view',
  validateSearch: (search: Record<string, unknown>): { list?: string } => ({
    list: typeof search.list === 'string' && UUID.test(search.list) ? search.list : undefined,
  }),
  beforeLoad: ({ params }) => {
    if (!UUID.test(params.spaceId) || !isProjectView(params.view)) throw redirect({ to: '/w/$workspaceId', params: { workspaceId: params.workspaceId } });
  },
  component: function ProjectRoute() {
    const { workspaceId, spaceId, view } = projectRoute.useParams();
    const { list } = projectRoute.useSearch();
    return isProjectView(view) ? <ProjectPage key={spaceId} workspaceId={workspaceId} spaceId={spaceId} view={view} listId={list} /> : null;
  },
});

const projectIndexRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/p/$spaceId',
  beforeLoad: async ({ context, params }) => {
    const { defaultTaskView } = await context.queryClient.ensureQueryData(preferences);
    throw redirect({ to: '/w/$workspaceId/p/$spaceId/$view', params: { ...params, view: defaultTaskView } });
  },
});

/** A stable link to one task (used by notifications): opens it in its list. */
const taskLinkRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/t/$taskId',
  beforeLoad: async ({ context, params }) => {
    const home = redirect({ to: '/w/$workspaceId', params: { workspaceId: params.workspaceId } });
    if (!UUID.test(params.taskId)) throw home;
    const task = await context.queryClient
      .ensureQueryData({ queryKey: queryKeys.task(params.workspaceId, params.taskId), queryFn: () => tasksApi.get(params.workspaceId, params.taskId) })
      .catch(() => null);
    if (!task) throw home;
    const { defaultTaskView } = await context.queryClient.ensureQueryData(preferences);
    throw redirect({ to: '/w/$workspaceId/p/$spaceId/$view', params: { workspaceId: params.workspaceId, spaceId: task.spaceId, view: defaultTaskView }, search: { task: task.id } });
  },
});

/** Old sprint links open the project's Sprints tab. */
const sprintsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/s/$spaceId/sprints',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/w/$workspaceId/p/$spaceId/$view', params: { ...params, view: 'sprints' } });
  },
});

const sprintBoardRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/sprints/$sprintId',
  component: function SprintBoardRoute() {
    const { workspaceId, sprintId } = sprintBoardRoute.useParams();
    return <SprintBoardPage key={sprintId} workspaceId={workspaceId} sprintId={sprintId} />;
  },
});

const documentsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/docs',
  component: function DocumentsRoute() {
    return <DocumentsPage workspaceId={workspaceRoute.useParams().workspaceId} documentId={undefined} />;
  },
});

const documentRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/docs/$documentId',
  beforeLoad: ({ params }) => {
    if (!UUID.test(params.documentId)) throw redirect({ to: '/w/$workspaceId/docs', params: { workspaceId: params.workspaceId } });
  },
  component: function DocumentRoute() {
    const { workspaceId, documentId } = documentRoute.useParams();
    return <DocumentsPage workspaceId={workspaceId} documentId={documentId} />;
  },
});

const chatSearch = (search: Record<string, unknown>): { thread?: string } => ({
  thread: typeof search.thread === 'string' && UUID.test(search.thread) ? search.thread : undefined,
});

const chatRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/chat',
  component: function ChatRoute() {
    return <ChatPage workspaceId={workspaceRoute.useParams().workspaceId} channelId={undefined} threadId={undefined} />;
  },
});

const chatChannelRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/chat/$channelId',
  validateSearch: chatSearch,
  beforeLoad: ({ params }) => {
    if (!UUID.test(params.channelId)) throw redirect({ to: '/w/$workspaceId/chat', params: { workspaceId: params.workspaceId } });
  },
  component: function ChatChannelRoute() {
    const { workspaceId, channelId } = chatChannelRoute.useParams();
    const { thread } = chatChannelRoute.useSearch();
    return <ChatPage workspaceId={workspaceId} channelId={channelId} threadId={thread} />;
  },
});

/** A simple page under /w/$workspaceId that only needs the workspace id. */
function workspacePage<TPath extends string>(path: TPath, Page: (props: { workspaceId: string }) => React.ReactNode) {
  return createRoute({
    getParentRoute: () => workspaceRoute,
    path,
    component: function WorkspacePageRoute() {
      return <Page workspaceId={workspaceRoute.useParams().workspaceId} />;
    },
  });
}

const directoryRoute = workspacePage('/people', DirectoryPage);
const departmentsRoute = workspacePage('/people/departments', DepartmentsPage);
const timeOffRoute = workspacePage('/people/time-off', TimeOffPage);
const approvalsRoute = workspacePage('/people/approvals', ApprovalsPage);
const leaveTypesRoute = workspacePage('/people/leave-types', LeaveTypesPage);
const auditLogRoute = workspacePage('/audit-log', WorkspaceAuditLogPage);
const inboxRoute = workspacePage('/inbox', InboxPage);
const myTasksRoute = workspacePage('/my-tasks', MyTasksPage);
const dailyLogRoute = workspacePage('/daily-log', DailyLogPage);
const timesheetsRoute = workspacePage('/timesheets', TimesheetsPage);

const membersRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/members',
  component: function MembersRoute() {
    return <MembersPage workspaceId={workspaceRoute.useParams().workspaceId} />;
  },
});

const rolesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/roles',
  component: function RolesRoute() {
    return <RolesPage workspaceId={workspaceRoute.useParams().workspaceId} />;
  },
});

/** Personal appearance settings; shown inside the workspace shell, saved per user (not per workspace). */
const appearanceRoute = createRoute({ getParentRoute: () => workspaceRoute, path: '/appearance', component: AppearancePage });

const settingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/settings',
  component: function SettingsRoute() {
    return <WorkspaceSettingsPage workspaceId={workspaceRoute.useParams().workspaceId} />;
  },
});

const routeTree = rootRoute.addChildren([
  publicLayout.addChildren([signInRoute, signUpRoute, forgotPasswordRoute, resetPasswordRoute]),
  appLayout.addChildren([
    indexRoute,
    onboardingRoute,
    adminRoute.addChildren([adminIndexRoute, adminUsersRoute, adminWorkspacesRoute, adminAuditRoute]),
    workspaceRoute.addChildren([
      workspaceHomeRoute,
      inboxRoute,
      taskLinkRoute,
      listRoute,
      projectRoute,
      projectIndexRoute,
      myTasksRoute,
      dailyLogRoute,
      timesheetsRoute,
      sprintsRoute,
      sprintBoardRoute,
      documentsRoute,
      documentRoute,
      chatRoute,
      chatChannelRoute,
      directoryRoute,
      departmentsRoute,
      timeOffRoute,
      approvalsRoute,
      leaveTypesRoute,
      auditLogRoute,
      membersRoute,
      rolesRoute,
      settingsRoute,
      appearanceRoute,
    ]),
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent', scrollRestoration: true });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
