import type { CustomFieldOption, CustomFieldType } from './custom-field.js';
import type { DocKind } from './document.js';
import type { IconKey } from './hierarchy.js';
import type { StatusCategory, TaskPriority, TaskType } from './task.js';

/**
 * A project template: everything a new space starts with. Templates are plain
 * data (no ids), so they can be exported as JSON, shared between workspaces
 * and imported again; the API validates every field on the way in.
 */
export interface TemplateContent {
  version: 1;
  space: { color: string; icon: IconKey | null };
  /** In board order; at least one. Empty means the default statuses. */
  statuses: { name: string; color: string; category: StatusCategory }[];
  customFields: { name: string; type: CustomFieldType; options?: Omit<CustomFieldOption, 'id'>[]; required?: boolean }[];
  /** `parent` is the index of another folder earlier in this list. */
  folders: { name: string; icon?: IconKey | null; color?: string | null; parent?: number | null }[];
  /** `folder` is an index into `folders`. */
  lists: { name: string; icon?: IconKey | null; color?: string | null; folder?: number | null }[];
  /** `list` is an index into `lists`; `status` a status name; `subtasks` are titles. */
  tasks: { title: string; list: number; description?: string; status?: string; priority?: TaskPriority; type?: TaskType; estimateMinutes?: number | null; subtasks?: string[] }[];
  /** `parent` is the index of an earlier doc. */
  docs: { title: string; kind?: DocKind; icon?: IconKey | null; content?: string; parent?: number | null }[];
}

export const TEMPLATE_LIMITS = {
  nameMax: 80,
  descriptionMax: 300,
  /** The JSON text of an import. */
  importBytesMax: 512 * 1024,
  statuses: 30,
  customFields: 30,
  folders: 50,
  lists: 100,
  tasks: 300,
  subtasksPerTask: 20,
  docs: 50,
  perWorkspace: 100,
} as const;

export const TEMPLATE_CATEGORIES = ['engineering', 'marketing', 'operations', 'people', 'general'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface BuiltInTemplate {
  key: string;
  name: string;
  description: string;
  category: TemplateCategory;
  content: TemplateContent;
}

const STANDARD_STATUSES: TemplateContent['statuses'] = [
  { name: 'To do', color: '#64748b', category: 'unstarted' },
  { name: 'In progress', color: '#0ea5e9', category: 'started' },
  { name: 'In review', color: '#a855f7', category: 'review' },
  { name: 'Done', color: '#22c55e', category: 'done' },
];

/** Ready-made templates that ship with the app, like a marketplace that needs no review. */
export const BUILT_IN_TEMPLATES: readonly BuiltInTemplate[] = [
  {
    key: 'scrum',
    name: 'Scrum team',
    description: 'A product backlog, bugs and sprint-ready statuses, with story points and a team working agreement.',
    category: 'engineering',
    content: {
      version: 1,
      space: { color: '#6366f1', icon: 'rocket' },
      statuses: [
        { name: 'Backlog', color: '#94a3b8', category: 'unstarted' },
        { name: 'Ready', color: '#64748b', category: 'unstarted' },
        { name: 'In progress', color: '#0ea5e9', category: 'started' },
        { name: 'Code review', color: '#a855f7', category: 'review' },
        { name: 'Blocked', color: '#ef4444', category: 'blocked' },
        { name: 'Done', color: '#22c55e', category: 'done' },
      ],
      customFields: [
        { name: 'Story points', type: 'number' },
        { name: 'Component', type: 'select', options: [{ label: 'Web', color: '#0ea5e9' }, { label: 'API', color: '#6366f1' }, { label: 'Mobile', color: '#f97316' }] },
      ],
      folders: [],
      lists: [
        { name: 'Product backlog', icon: 'list' },
        { name: 'Bugs', icon: 'bug', color: '#ef4444' },
        { name: 'Tech debt', icon: 'wrench' },
      ],
      tasks: [
        { title: 'Write the first user stories', list: 0, status: 'Ready', type: 'feature', priority: 'high', subtasks: ['Agree on the definition of ready', 'Size the top ten stories'] },
        { title: 'Set up CI for every pull request', list: 2, type: 'task', priority: 'normal' },
        { title: 'Example bug: describe steps to reproduce', list: 1, type: 'bug', priority: 'normal' },
      ],
      docs: [
        { title: 'Team working agreement', icon: 'handshake', content: '## How we work\n\n- Sprints are two weeks.\n- Stand-up at 9:30, fifteen minutes.\n- A story is done when it is reviewed, merged and released.\n' },
        { title: 'Definition of done', icon: 'flag', content: '- Code reviewed\n- Tests pass\n- Docs updated\n- Released behind a flag or to everyone\n' },
      ],
    },
  },
  {
    key: 'kanban',
    name: 'Kanban board',
    description: 'A simple continuous flow: to do, doing, done, with a limit on work in progress.',
    category: 'general',
    content: {
      version: 1,
      space: { color: '#0ea5e9', icon: 'zap' },
      statuses: [
        { name: 'To do', color: '#64748b', category: 'unstarted' },
        { name: 'Doing', color: '#0ea5e9', category: 'started' },
        { name: 'Waiting', color: '#eab308', category: 'blocked' },
        { name: 'Done', color: '#22c55e', category: 'done' },
      ],
      customFields: [],
      folders: [],
      lists: [{ name: 'Board', icon: 'list' }],
      tasks: [{ title: 'Agree on a work-in-progress limit', list: 0, priority: 'normal' }],
      docs: [],
    },
  },
  {
    key: 'bug-tracking',
    name: 'Bug tracking',
    description: 'Triage, fix and verify bugs, with severity and the environment they were found in.',
    category: 'engineering',
    content: {
      version: 1,
      space: { color: '#ef4444', icon: 'bug' },
      statuses: [
        { name: 'New', color: '#94a3b8', category: 'unstarted' },
        { name: 'Triaged', color: '#64748b', category: 'unstarted' },
        { name: 'Fixing', color: '#0ea5e9', category: 'started' },
        { name: 'Verifying', color: '#a855f7', category: 'review' },
        { name: 'Fixed', color: '#22c55e', category: 'done' },
        { name: "Won't fix", color: '#9ca3af', category: 'cancelled' },
      ],
      customFields: [
        {
          name: 'Severity',
          type: 'select',
          required: true,
          options: [{ label: 'Critical', color: '#ef4444' }, { label: 'Major', color: '#f97316' }, { label: 'Minor', color: '#eab308' }, { label: 'Trivial', color: '#64748b' }],
        },
        { name: 'Environment', type: 'select', options: [{ label: 'Production', color: '#ef4444' }, { label: 'Staging', color: '#eab308' }, { label: 'Local', color: '#64748b' }] },
        { name: 'Reported by', type: 'email' },
      ],
      folders: [],
      lists: [
        { name: 'Inbox', icon: 'mail' },
        { name: 'Known issues', icon: 'shield' },
      ],
      tasks: [],
      docs: [{ title: 'How to report a bug', icon: 'notebook', content: '1. What did you do?\n2. What did you expect?\n3. What happened instead?\n4. Screenshot or log, if you have one.\n' }],
    },
  },
  {
    key: 'marketing-campaign',
    name: 'Marketing campaign',
    description: 'Plan, produce and launch a campaign across channels, with budget and channel fields.',
    category: 'marketing',
    content: {
      version: 1,
      space: { color: '#ec4899', icon: 'megaphone' },
      statuses: [
        { name: 'Idea', color: '#94a3b8', category: 'unstarted' },
        { name: 'Planned', color: '#64748b', category: 'unstarted' },
        { name: 'In production', color: '#0ea5e9', category: 'started' },
        { name: 'Approval', color: '#a855f7', category: 'review' },
        { name: 'Live', color: '#22c55e', category: 'done' },
      ],
      customFields: [
        { name: 'Channel', type: 'multi_select', options: [{ label: 'Email', color: '#0ea5e9' }, { label: 'Social', color: '#ec4899' }, { label: 'Paid', color: '#f97316' }, { label: 'Blog', color: '#22c55e' }] },
        { name: 'Budget', type: 'money' },
        { name: 'Launch date', type: 'date' },
      ],
      folders: [{ name: 'Campaign', icon: 'target' }],
      lists: [
        { name: 'Planning', icon: 'calendar', folder: 0 },
        { name: 'Content', icon: 'pen', folder: 0 },
        { name: 'Launch', icon: 'rocket', folder: 0 },
      ],
      tasks: [
        { title: 'Write the campaign brief', list: 0, priority: 'high' },
        { title: 'Pick channels and budget', list: 0 },
        { title: 'Draft the launch email', list: 1 },
        { title: 'Schedule social posts', list: 1 },
        { title: 'Go live and watch the numbers', list: 2, subtasks: ['Check tracking links', 'Share results after a week'] },
      ],
      docs: [{ title: 'Campaign brief', icon: 'file', content: '## Goal\n\n## Audience\n\n## Message\n\n## Channels and budget\n\n## How we measure success\n' }],
    },
  },
  {
    key: 'content-calendar',
    name: 'Content calendar',
    description: 'Draft, edit and publish articles and posts on a schedule.',
    category: 'marketing',
    content: {
      version: 1,
      space: { color: '#22c55e', icon: 'calendar' },
      statuses: [
        { name: 'Pitched', color: '#94a3b8', category: 'unstarted' },
        { name: 'Writing', color: '#0ea5e9', category: 'started' },
        { name: 'Editing', color: '#a855f7', category: 'review' },
        { name: 'Published', color: '#22c55e', category: 'done' },
      ],
      customFields: [
        { name: 'Format', type: 'select', options: [{ label: 'Article', color: '#0ea5e9' }, { label: 'Video', color: '#ef4444' }, { label: 'Newsletter', color: '#a855f7' }] },
        { name: 'Link', type: 'url' },
      ],
      folders: [],
      lists: [
        { name: 'Blog', icon: 'pen' },
        { name: 'Newsletter', icon: 'mail' },
        { name: 'Social', icon: 'message' },
      ],
      tasks: [],
      docs: [{ title: 'Style guide', icon: 'book', content: '- Write for one reader.\n- Short sentences.\n- Every post ends with one clear next step.\n' }],
    },
  },
  {
    key: 'product-launch',
    name: 'Product launch',
    description: 'Get a release out the door: readiness, go-to-market and follow-up, grouped in folders.',
    category: 'operations',
    content: {
      version: 1,
      space: { color: '#f97316', icon: 'trophy' },
      statuses: STANDARD_STATUSES,
      customFields: [{ name: 'Owner team', type: 'select', options: [{ label: 'Product', color: '#6366f1' }, { label: 'Engineering', color: '#0ea5e9' }, { label: 'Marketing', color: '#ec4899' }, { label: 'Support', color: '#22c55e' }] }],
      folders: [{ name: 'Before launch', icon: 'flag' }, { name: 'After launch', icon: 'chart' }],
      lists: [
        { name: 'Readiness', icon: 'shield', folder: 0 },
        { name: 'Go to market', icon: 'megaphone', folder: 0 },
        { name: 'Follow-up', icon: 'trending', folder: 1 },
      ],
      tasks: [
        { title: 'Release checklist signed off', list: 0, priority: 'urgent' },
        { title: 'Support has the FAQ', list: 0 },
        { title: 'Announcement post and email', list: 1 },
        { title: 'Review adoption after two weeks', list: 2 },
      ],
      docs: [{ title: 'Launch plan', icon: 'rocket', content: '## What is launching\n\n## Who it is for\n\n## Date and rollout\n\n## Risks\n' }],
    },
  },
  {
    key: 'client-project',
    name: 'Client project',
    description: 'Deliver work for a client: phases as folders, milestones, budget and a shared status update.',
    category: 'operations',
    content: {
      version: 1,
      space: { color: '#0f766e', icon: 'briefcase' },
      statuses: [
        { name: 'Not started', color: '#64748b', category: 'unstarted' },
        { name: 'Working on it', color: '#0ea5e9', category: 'started' },
        { name: 'Client review', color: '#a855f7', category: 'review' },
        { name: 'Waiting on client', color: '#eab308', category: 'blocked' },
        { name: 'Delivered', color: '#22c55e', category: 'done' },
      ],
      customFields: [
        { name: 'Billable', type: 'checkbox' },
        { name: 'Budget hours', type: 'number' },
      ],
      folders: [{ name: 'Discovery', icon: 'compass' }, { name: 'Delivery', icon: 'box' }],
      lists: [
        { name: 'Workshops', icon: 'users', folder: 0 },
        { name: 'Milestones', icon: 'flag', folder: 1 },
        { name: 'Change requests', icon: 'pen', folder: 1 },
      ],
      tasks: [
        { title: 'Kick-off meeting', list: 0, priority: 'high' },
        { title: 'Milestone 1: first draft', list: 1 },
      ],
      docs: [{ title: 'Statement of work summary', icon: 'file', content: '## Scope\n\n## Out of scope\n\n## Milestones\n\n## Contacts\n' }],
    },
  },
  {
    key: 'employee-onboarding',
    name: 'Employee onboarding',
    description: 'Welcome new starters with a checklist for their first day, week and month.',
    category: 'people',
    content: {
      version: 1,
      space: { color: '#a855f7', icon: 'users' },
      statuses: STANDARD_STATUSES,
      customFields: [{ name: 'Start date', type: 'date' }, { name: 'Buddy', type: 'user' }],
      folders: [],
      lists: [
        { name: 'Before day one', icon: 'calendar' },
        { name: 'First week', icon: 'coffee' },
        { name: 'First month', icon: 'graduation' },
      ],
      tasks: [
        { title: 'Order a laptop and accounts', list: 0, priority: 'high' },
        { title: 'Welcome lunch with the team', list: 1 },
        { title: '30-day check-in', list: 2 },
      ],
      docs: [{ title: 'Welcome guide', icon: 'heart', content: '## Welcome!\n\nEverything you need for your first weeks.\n' }],
    },
  },
];
