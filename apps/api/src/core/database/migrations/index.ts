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
import { AutomationSchedules1729850000000 } from './1729850000000-automation-schedules.js';
import { DashboardPeriod1729860000000 } from './1729860000000-dashboard-period.js';
import { Attendance1729870000000 } from './1729870000000-attendance.js';
import { AutomationWebhooks1729880000000 } from './1729880000000-automation-webhooks.js';
import { AccessRequests1729890000000 } from './1729890000000-access-requests.js';
import { GithubSyncLog1729900000000 } from './1729900000000-github-sync-log.js';
import { AccessGrants1729960000000 } from './1729960000000-access-grants.js';
import { TwoStepRequirement1729970000000 } from './1729970000000-two-step-requirement.js';
import { LiveDocs1729980000000 } from './1729980000000-live-docs.js';
import { Organizations1729990000000 } from './1729990000000-organizations.js';
import { Calls1730000000000 } from './1730000000000-calls.js';
import { Office1730010000000 } from './1730010000000-office.js';
import { GithubApp1730020000000 } from './1730020000000-github-app.js';
import { UploadPreviews1730030000000 } from './1730030000000-upload-previews.js';
import { TeamLayouts1730040000000 } from './1730040000000-team-layouts.js';
import { DashboardVersions1730050000000 } from './1730050000000-dashboard-versions.js';
import { TaskChecklists1730060000000 } from './1730060000000-task-checklists.js';
import { CommentMentions1730070000000 } from './1730070000000-comment-mentions.js';
import { GithubConflicts1729950000000 } from './1729950000000-github-conflicts.js';
import { ChatRetention1729940000000 } from './1729940000000-chat-retention.js';
import { DashboardTeams1729930000000 } from './1729930000000-dashboard-teams.js';
import { DashboardCustomPeriod1729920000000 } from './1729920000000-dashboard-custom-period.js';
import { LayoutLocks1729910000000 } from './1729910000000-layout-locks.js';
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
  AutomationSchedules1729850000000,
  DashboardPeriod1729860000000,
  Attendance1729870000000,
  AutomationWebhooks1729880000000,
  AccessRequests1729890000000,
  GithubSyncLog1729900000000,
  LayoutLocks1729910000000,
  DashboardCustomPeriod1729920000000,
  DashboardTeams1729930000000,
  ChatRetention1729940000000,
  GithubConflicts1729950000000,
  AccessGrants1729960000000,
  TwoStepRequirement1729970000000,
  LiveDocs1729980000000,
  Organizations1729990000000,
  Calls1730000000000,
  Office1730010000000,
  GithubApp1730020000000,
  UploadPreviews1730030000000,
  TeamLayouts1730040000000,
  DashboardVersions1730050000000,
  TaskChecklists1730060000000,
  CommentMentions1730070000000,
];
