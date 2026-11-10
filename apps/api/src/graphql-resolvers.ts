/**
 * Every GraphQL resolver in the app, used to export the schema without a running server.
 * graphql-resolvers.spec.ts fails if a resolver is added to a module but not listed here.
 */
import { AdminResolver } from './modules/admin/presentation/graphql/admin.resolver.js';
import { WorkspaceAuditLogResolver } from './modules/audit-log/presentation/graphql/workspace-audit-log.resolver.js';
import { CommentsResolver } from './modules/comments/presentation/graphql/comments.resolver.js';
import { DocumentsResolver } from './modules/documents/presentation/graphql/documents.resolver.js';
import { OrganizationsResolver } from './modules/organizations/presentation/graphql/organizations.resolver.js';
import { OfficeResolver } from './modules/office/presentation/graphql/office.resolver.js';
import { DepartmentsResolver } from './modules/hr/departments/presentation/graphql/departments.resolver.js';
import { EmployeesResolver } from './modules/hr/employees/presentation/graphql/employees.resolver.js';
import { LeaveResolver } from './modules/hr/leave/presentation/graphql/leave.resolver.js';
import { AccessReviewResolver } from './modules/access-review/presentation/graphql/access-review.resolver.js';
import { AttendanceResolver } from './modules/hr/attendance/presentation/graphql/attendance.resolver.js';
import { FoldersResolver } from './modules/lists/presentation/graphql/folders.resolver.js';
import { GithubResolver } from './modules/integrations/presentation/graphql/github.resolver.js';
import { AutomationsResolver } from './modules/automations/presentation/graphql/automations.resolver.js';
import { TemplatesResolver } from './modules/templates/presentation/graphql/templates.resolver.js';
import { ListsResolver } from './modules/lists/presentation/graphql/lists.resolver.js';
import { MembersResolver } from './modules/members/presentation/graphql/members.resolver.js';
import { NotificationsResolver } from './modules/notifications/presentation/graphql/notifications.resolver.js';
import { WorkspaceEventsResolver } from './modules/realtime/presentation/graphql/workspace-events.resolver.js';
import { CustomFieldsResolver } from './modules/custom-fields/presentation/graphql/custom-fields.resolver.js';
import { AnalyticsResolver } from './modules/analytics/presentation/graphql/analytics.resolver.js';
import { TimeResolver } from './modules/time-tracking/presentation/graphql/time.resolver.js';
import { StatusesResolver } from './modules/statuses/presentation/graphql/statuses.resolver.js';
import { FormSchemaResolver } from './modules/forms/presentation/graphql/form-schema.resolver.js';
import { SignInOptionsResolver } from './modules/forms/presentation/graphql/sign-in-options.resolver.js';
import { PreferencesResolver, SavedViewFieldsResolver } from './modules/preferences/presentation/graphql/preferences.resolver.js';
import { DashboardsResolver } from './modules/layouts/presentation/graphql/dashboards.resolver.js';
import { LayoutsResolver } from './modules/layouts/presentation/graphql/layouts.resolver.js';
import { ChatRetentionResolver } from './modules/chat/presentation/graphql/chat-retention.resolver.js';
import { CallsResolver } from './modules/chat/presentation/graphql/calls.resolver.js';
import { ChatResolver } from './modules/chat/presentation/graphql/chat.resolver.js';
import { TaskAttachmentsResolver } from './modules/attachments/presentation/graphql/task-attachments.resolver.js';
import { ResourceSchemaResolver } from './modules/resources/presentation/graphql/resource-schema.resolver.js';
import { PoliciesResolver } from './modules/roles/presentation/graphql/policies.resolver.js';
import { RolesResolver } from './modules/roles/presentation/graphql/roles.resolver.js';
import { SpacesResolver } from './modules/spaces/presentation/graphql/spaces.resolver.js';
import { SprintsResolver } from './modules/sprints/presentation/graphql/sprints.resolver.js';
import { TasksResolver } from './modules/tasks/presentation/graphql/tasks.resolver.js';
import { MeResolver } from './modules/users/presentation/graphql/me.resolver.js';
import { WorkspacesResolver } from './modules/workspaces/presentation/graphql/workspaces.resolver.js';

export const RESOLVERS = [
  MeResolver,
  WorkspacesResolver,
  MembersResolver,
  RolesResolver,
  PoliciesResolver,
  SpacesResolver,
  ListsResolver,
  FoldersResolver,
  TemplatesResolver,
  AutomationsResolver,
  GithubResolver,
  TasksResolver,
  CommentsResolver,
  SprintsResolver,
  DocumentsResolver,
  OrganizationsResolver,
  OfficeResolver,
  DepartmentsResolver,
  EmployeesResolver,
  LeaveResolver,
  AttendanceResolver,
  AccessReviewResolver,
  WorkspaceAuditLogResolver,
  AdminResolver,
  NotificationsResolver,
  WorkspaceEventsResolver,
  ResourceSchemaResolver,
  FormSchemaResolver,
  SignInOptionsResolver,
  PreferencesResolver,
  LayoutsResolver,
  DashboardsResolver,
  ChatResolver,
  ChatRetentionResolver,
  CallsResolver,
  TaskAttachmentsResolver,
  SavedViewFieldsResolver,
  StatusesResolver,
  CustomFieldsResolver,
  TimeResolver,
  AnalyticsResolver,
];
