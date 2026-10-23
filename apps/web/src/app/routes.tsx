import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { fetchCurrentUser } from '@/core/api/current-user.api';
import { hasSession } from '@/core/auth/session';
import { queryKeys } from '@/lib/query-keys';
import { AdminAuditLogPage, AdminLayout, AdminUsersPage, AdminWorkspacesPage } from '@/modules/admin';
import { WorkspaceAuditLogPage } from '@/modules/audit-log';
import { ForgotPasswordPage, ResetPasswordPage, SignInPage, SignUpPage } from '@/modules/auth';
import { DocumentsPage } from '@/modules/documents';
import { HomePage } from '@/modules/home';
import { ApprovalsPage, DepartmentsPage, DirectoryPage, LeaveTypesPage, TimeOffPage } from '@/modules/hr';
import { ListPage } from '@/modules/lists';
import { MembersPage } from '@/modules/members';
import { RolesPage } from '@/modules/roles';
import { SprintBoardPage, SprintsPage } from '@/modules/sprints';
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
  },
  component: Outlet,
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

const workspaceRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/w/$workspaceId',
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
    return <WorkspaceLayout workspaceId={workspaceId} />;
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

const listRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/l/$listId',
  validateSearch: (search: Record<string, unknown>): { task?: string } => ({
    task: typeof search.task === 'string' && UUID.test(search.task) ? search.task : undefined,
  }),
  component: function ListRoute() {
    const { workspaceId, listId } = listRoute.useParams();
    const { task } = listRoute.useSearch();
    return <ListPage key={listId} workspaceId={workspaceId} listId={listId} openTaskId={task} />;
  },
});

const taskSearch = (search: Record<string, unknown>): { task?: string } => ({
  task: typeof search.task === 'string' && UUID.test(search.task) ? search.task : undefined,
});

const sprintsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/s/$spaceId/sprints',
  validateSearch: taskSearch,
  component: function SprintsRoute() {
    const { workspaceId, spaceId } = sprintsRoute.useParams();
    const { task } = sprintsRoute.useSearch();
    return <SprintsPage key={spaceId} workspaceId={workspaceId} spaceId={spaceId} openTaskId={task} />;
  },
});

const sprintBoardRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/sprints/$sprintId',
  validateSearch: taskSearch,
  component: function SprintBoardRoute() {
    const { workspaceId, sprintId } = sprintBoardRoute.useParams();
    const { task } = sprintBoardRoute.useSearch();
    return <SprintBoardPage key={sprintId} workspaceId={workspaceId} sprintId={sprintId} openTaskId={task} />;
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
      listRoute,
      sprintsRoute,
      sprintBoardRoute,
      documentsRoute,
      documentRoute,
      directoryRoute,
      departmentsRoute,
      timeOffRoute,
      approvalsRoute,
      leaveTypesRoute,
      auditLogRoute,
      membersRoute,
      rolesRoute,
      settingsRoute,
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
