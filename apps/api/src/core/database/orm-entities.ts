import { AuditLogOrmEntity } from '../audit/audit-log.orm-entity.js';
import { CommentOrmEntity } from '../../modules/comments/infrastructure/comment.orm-entity.js';
import { DocumentOrmEntity } from '../../modules/documents/infrastructure/document.orm-entity.js';
import { DepartmentOrmEntity } from '../../modules/hr/departments/infrastructure/department.orm-entity.js';
import { EmployeeProfileOrmEntity } from '../../modules/hr/employees/infrastructure/employee-profile.orm-entity.js';
import { LeaveRequestOrmEntity } from '../../modules/hr/leave/infrastructure/leave-request.orm-entity.js';
import { LeaveTypeOrmEntity } from '../../modules/hr/leave/infrastructure/leave-type.orm-entity.js';
import { ListFolderOrmEntity } from '../../modules/lists/infrastructure/list-folder.orm-entity.js';
import { AutomationRuleOrmEntity, AutomationRunOrmEntity } from '../../modules/automations/infrastructure/automation.orm-entities.js';
import { ProjectTemplateOrmEntity } from '../../modules/templates/infrastructure/project-template.orm-entity.js';
import { TaskListOrmEntity } from '../../modules/lists/infrastructure/task-list.orm-entity.js';
import { WorkspaceMemberOrmEntity } from '../../modules/members/infrastructure/workspace-member.orm-entity.js';
import { NotificationOrmEntity } from '../../modules/notifications/infrastructure/notification.orm-entity.js';
import { TimeEntryOrmEntity } from '../../modules/time-tracking/infrastructure/time-entry.orm-entity.js';
import { UserPreferenceOrmEntity } from '../../modules/preferences/infrastructure/user-preference.orm-entity.js';
import { PolicyOrmEntity } from '../../modules/roles/infrastructure/policy.orm-entity.js';
import { RolePolicyOrmEntity } from '../../modules/roles/infrastructure/role-policy.orm-entity.js';
import { WorkspaceRoleOrmEntity } from '../../modules/roles/infrastructure/workspace-role.orm-entity.js';
import { SpaceOrmEntity } from '../../modules/spaces/infrastructure/space.orm-entity.js';
import { SprintOrmEntity } from '../../modules/sprints/infrastructure/sprint.orm-entity.js';
import { TaskOrmEntity } from '../../modules/tasks/infrastructure/task.orm-entity.js';
import { TaskActivityOrmEntity, TaskRelationOrmEntity, TaskWatcherOrmEntity } from '../../modules/tasks/infrastructure/task-extras.orm-entities.js';
import { TaskStatusOrmEntity } from '../../modules/statuses/infrastructure/task-status.orm-entity.js';
import { CustomFieldOrmEntity } from '../../modules/custom-fields/infrastructure/custom-field.orm-entity.js';
import { UserOrmEntity } from '../../modules/users/infrastructure/user.orm-entity.js';
import { WorkspaceOrmEntity } from '../../modules/workspaces/infrastructure/workspace.orm-entity.js';

/**
 * Every ORM entity the data source knows about. This is the one place core
 * lists module files, because TypeORM needs them all at startup.
 */
export const ORM_ENTITIES = [
  UserOrmEntity,
  WorkspaceOrmEntity,
  WorkspaceRoleOrmEntity,
  PolicyOrmEntity,
  UserPreferenceOrmEntity,
  TimeEntryOrmEntity,
  RolePolicyOrmEntity,
  WorkspaceMemberOrmEntity,
  SpaceOrmEntity,
  TaskListOrmEntity,
  ListFolderOrmEntity,
  ProjectTemplateOrmEntity,
  AutomationRuleOrmEntity,
  AutomationRunOrmEntity,
  TaskOrmEntity,
  TaskStatusOrmEntity,
  TaskWatcherOrmEntity,
  TaskRelationOrmEntity,
  TaskActivityOrmEntity,
  CustomFieldOrmEntity,
  CommentOrmEntity,
  SprintOrmEntity,
  DocumentOrmEntity,
  DepartmentOrmEntity,
  EmployeeProfileOrmEntity,
  LeaveTypeOrmEntity,
  LeaveRequestOrmEntity,
  AuditLogOrmEntity,
  NotificationOrmEntity,
];
