import { InitialSchema1729550000000 } from './1729550000000-initial-schema.js';
import { HardenUserFields1729550100000 } from './1729550100000-harden-user-fields.js';
import { TaskComments1729560000000 } from './1729560000000-task-comments.js';
import { Sprints1729570000000 } from './1729570000000-sprints.js';
import { Documents1729580000000 } from './1729580000000-documents.js';
import { Hr1729590000000 } from './1729590000000-hr.js';
import { RowLevelSecurity1729600000000 } from './1729600000000-row-level-security.js';
import { Notifications1729610000000 } from './1729610000000-notifications.js';
import { TaskMetadata1729620000000 } from './1729620000000-task-metadata.js';
import { IamPolicies1729630000000 } from './1729630000000-iam-policies.js';
import { UserPreferences1729640000000 } from './1729640000000-user-preferences.js';
import { DocumentFolders1729670000000 } from './1729670000000-document-folders.js';
import { TimeTracking1729660000000 } from './1729660000000-time-tracking.js';
import { TaskModelV21729650000000 } from './1729650000000-task-model-v2.js';
import { SpaceHierarchy1729680000000 } from './1729680000000-space-hierarchy.js';
import { SpaceAccess1729690000000 } from './1729690000000-space-access.js';
import { ProjectTemplates1729700000000 } from './1729700000000-project-templates.js';
import { Automations1729710000000 } from './1729710000000-automations.js';
import { GithubIntegration1729720000000 } from './1729720000000-github-integration.js';
import { Dashboards1729760000000 } from './1729760000000-dashboards.js';
import { Chat1729770000000 } from './1729770000000-chat.js';
import { ChatMentions1729780000000 } from './1729780000000-chat-mentions.js';
import { ChatReactions1729790000000 } from './1729790000000-chat-reactions.js';
import { ChatSearch1729800000000 } from './1729800000000-chat-search.js';
import { ChatAttachments1729810000000 } from './1729810000000-chat-attachments.js';
import { LayoutDefaultsAndVersions1729820000000 } from './1729820000000-layout-defaults-and-versions.js';
import { TaskAttachments1729830000000 } from './1729830000000-task-attachments.js';
import { AutomationFlows1729840000000 } from './1729840000000-automation-flows.js';
import { SprintCommittedTasks1729750000000 } from './1729750000000-sprint-committed-tasks.js';
import { DashboardLayouts1729740000000 } from './1729740000000-dashboard-layouts.js';
import { MultipleAssignees1729730000000 } from './1729730000000-multiple-assignees.js';

/** Registered in order. Add new migrations to the end. */
export const MIGRATIONS = [
  InitialSchema1729550000000,
  HardenUserFields1729550100000,
  TaskComments1729560000000,
  Sprints1729570000000,
  Documents1729580000000,
  Hr1729590000000,
  RowLevelSecurity1729600000000,
  Notifications1729610000000,
  TaskMetadata1729620000000,
  IamPolicies1729630000000,
  UserPreferences1729640000000,
  TaskModelV21729650000000,
  TimeTracking1729660000000,
  DocumentFolders1729670000000,
  SpaceHierarchy1729680000000,
  SpaceAccess1729690000000,
  ProjectTemplates1729700000000,
  Automations1729710000000,
  GithubIntegration1729720000000,
  MultipleAssignees1729730000000,
  DashboardLayouts1729740000000,
  SprintCommittedTasks1729750000000,
  Dashboards1729760000000,
  Chat1729770000000,
  ChatMentions1729780000000,
  ChatReactions1729790000000,
  ChatSearch1729800000000,
  ChatAttachments1729810000000,
  LayoutDefaultsAndVersions1729820000000,
  TaskAttachments1729830000000,
  AutomationFlows1729840000000,
];
