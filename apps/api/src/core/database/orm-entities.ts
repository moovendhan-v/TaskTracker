import { AuditLogOrmEntity } from '../audit/audit-log.orm-entity.js';
import { CommentOrmEntity } from '../../modules/comments/infrastructure/comment.orm-entity.js';
import { DocumentOrmEntity } from '../../modules/documents/infrastructure/document.orm-entity.js';
import { DepartmentOrmEntity } from '../../modules/hr/departments/infrastructure/department.orm-entity.js';
import { EmployeeProfileOrmEntity } from '../../modules/hr/employees/infrastructure/employee-profile.orm-entity.js';
import { LeaveRequestOrmEntity } from '../../modules/hr/leave/infrastructure/leave-request.orm-entity.js';
import { LeaveTypeOrmEntity } from '../../modules/hr/leave/infrastructure/leave-type.orm-entity.js';
import { TaskListOrmEntity } from '../../modules/lists/infrastructure/task-list.orm-entity.js';
import { WorkspaceMemberOrmEntity } from '../../modules/members/infrastructure/workspace-member.orm-entity.js';
import { WorkspaceRoleOrmEntity } from '../../modules/roles/infrastructure/workspace-role.orm-entity.js';
import { SpaceOrmEntity } from '../../modules/spaces/infrastructure/space.orm-entity.js';
import { SprintOrmEntity } from '../../modules/sprints/infrastructure/sprint.orm-entity.js';
import { TaskOrmEntity } from '../../modules/tasks/infrastructure/task.orm-entity.js';
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
  WorkspaceMemberOrmEntity,
  SpaceOrmEntity,
  TaskListOrmEntity,
  TaskOrmEntity,
  CommentOrmEntity,
  SprintOrmEntity,
  DocumentOrmEntity,
  DepartmentOrmEntity,
  EmployeeProfileOrmEntity,
  LeaveTypeOrmEntity,
  LeaveRequestOrmEntity,
  AuditLogOrmEntity,
];
