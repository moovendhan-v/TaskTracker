import { AuditLogEntity } from '../audit/audit-log.entity.js';
import { TaskListEntity } from '../lists/entities/task-list.entity.js';
import { WorkspaceMemberEntity } from '../members/workspace-member.entity.js';
import { WorkspaceRoleEntity } from '../roles/entities/workspace-role.entity.js';
import { SpaceEntity } from '../spaces/entities/space.entity.js';
import { TaskEntity } from '../tasks/entities/task.entity.js';
import { UserEntity } from '../users/user.entity.js';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity.js';

export const ENTITIES = [
  UserEntity,
  WorkspaceEntity,
  WorkspaceRoleEntity,
  WorkspaceMemberEntity,
  SpaceEntity,
  TaskListEntity,
  TaskEntity,
  AuditLogEntity,
];
