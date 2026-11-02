import type { Permission } from '@taskflow/shared-types';

interface PermissionGroup {
  label: string;
  permissions: { key: Permission; label: string }[];
}

/** How permissions are grouped and worded in the role editor. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Workspace',
    permissions: [
      { key: 'workspace.manage', label: 'Rename or delete the workspace (owners only)' },
      { key: 'members.manage', label: 'Add, remove and change members' },
      { key: 'roles.manage', label: 'Create and edit roles' },
      { key: 'audit.view', label: 'View the audit log' },
      { key: 'integration.manage', label: 'Connect and manage integrations like GitHub' },
    ],
  },
  {
    label: 'Structure',
    permissions: [
      { key: 'space.manage', label: 'Create, edit and delete spaces' },
      { key: 'list.manage', label: 'Create, edit and delete lists' },
      { key: 'sprint.manage', label: 'Plan, start and complete sprints' },
      { key: 'automation.manage', label: 'Create and change automations' },
    ],
  },
  {
    label: 'Tasks',
    permissions: [
      { key: 'task.view', label: 'View tasks' },
      { key: 'task.create', label: 'Create tasks' },
      { key: 'task.update', label: 'Edit tasks and comment' },
      { key: 'task.assign', label: 'Assign tasks' },
      { key: 'task.delete', label: 'Delete tasks and others’ comments' },
    ],
  },
  {
    label: 'Docs',
    permissions: [
      { key: 'doc.view', label: 'Read docs' },
      { key: 'doc.create', label: 'Create docs and edit their own' },
      { key: 'doc.manage', label: 'Edit, move and delete any doc' },
    ],
  },
  {
    label: 'Chat',
    permissions: [
      { key: 'chat.use', label: 'Read and post in chat, start direct messages and create channels' },
      { key: 'chat.manage', label: 'Rename, archive and remove people from any public channel' },
    ],
  },
  {
    label: 'Time',
    permissions: [
      { key: 'time.log', label: 'Track and log their own time' },
      { key: 'time.view_all', label: 'See everyone’s time and reports' },
      { key: 'time.manage', label: 'Correct or delete anyone’s time entries' },
    ],
  },
  {
    label: 'People',
    permissions: [
      { key: 'hr.view', label: 'View the team directory' },
      { key: 'hr.manage', label: 'Manage departments, profiles and leave types' },
      { key: 'leave.request', label: 'Request time off' },
      { key: 'leave.approve', label: 'Approve or reject time off' },
    ],
  },
];
