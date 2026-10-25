/**
 * Every GraphQL resolver in the app, used to export the schema without a running server.
 * graphql-resolvers.spec.ts fails if a resolver is added to a module but not listed here.
 */
import { AdminResolver } from './modules/admin/presentation/graphql/admin.resolver.js';
import { WorkspaceAuditLogResolver } from './modules/audit-log/presentation/graphql/workspace-audit-log.resolver.js';
import { CommentsResolver } from './modules/comments/presentation/graphql/comments.resolver.js';
import { DocumentsResolver } from './modules/documents/presentation/graphql/documents.resolver.js';
import { DepartmentsResolver } from './modules/hr/departments/presentation/graphql/departments.resolver.js';
import { EmployeesResolver } from './modules/hr/employees/presentation/graphql/employees.resolver.js';
import { LeaveResolver } from './modules/hr/leave/presentation/graphql/leave.resolver.js';
import { ListsResolver } from './modules/lists/presentation/graphql/lists.resolver.js';
import { MembersResolver } from './modules/members/presentation/graphql/members.resolver.js';
import { NotificationsResolver } from './modules/notifications/presentation/graphql/notifications.resolver.js';
import { WorkspaceEventsResolver } from './modules/realtime/presentation/graphql/workspace-events.resolver.js';
import { FormSchemaResolver } from './modules/forms/presentation/graphql/form-schema.resolver.js';
import { ResourceSchemaResolver } from './modules/resources/presentation/graphql/resource-schema.resolver.js';
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
  SpacesResolver,
  ListsResolver,
  TasksResolver,
  CommentsResolver,
  SprintsResolver,
  DocumentsResolver,
  DepartmentsResolver,
  EmployeesResolver,
  LeaveResolver,
  WorkspaceAuditLogResolver,
  AdminResolver,
  NotificationsResolver,
  WorkspaceEventsResolver,
  ResourceSchemaResolver,
  FormSchemaResolver,
];
