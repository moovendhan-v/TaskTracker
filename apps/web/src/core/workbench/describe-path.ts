import {
  Building2Icon,
  CalendarCheckIcon,
  CheckSquareIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HomeIcon,
  InboxIcon,
  ListIcon,
  MessagesSquareIcon,
  PaletteIcon,
  PalmtreeIcon,
  RocketIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldIcon,
  SquareIcon,
  TagsIcon,
  TimerIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon, KeyRoundIcon } from 'lucide-react';

/** What a tab shows: a fixed label and icon, plus the record whose name should replace the label once loaded. */
export interface TabDescription {
  label: string;
  icon: LucideIcon;
  entity?: { kind: 'list' | 'document' | 'sprint' | 'channel'; id: string } | { kind: 'space'; id: string; view: string };
}

const PAGES: Record<string, Omit<TabDescription, 'entity'>> = {
  '': { label: 'Home', icon: HomeIcon },
  '/inbox': { label: 'Inbox', icon: InboxIcon },
  '/docs': { label: 'Docs', icon: FileTextIcon },
  '/chat': { label: 'Chat', icon: MessagesSquareIcon },
  '/my-tasks': { label: 'My tasks', icon: CheckSquareIcon },
  '/daily-log': { label: 'Daily log', icon: CalendarCheckIcon },
  '/timesheets': { label: 'Timesheets', icon: TimerIcon },
  '/members': { label: 'Members', icon: UsersIcon },
  '/roles': { label: 'Roles', icon: ShieldIcon },
  '/access': { label: 'Access', icon: KeyRoundIcon },
  '/audit-log': { label: 'Audit log', icon: ScrollTextIcon },
  '/settings': { label: 'Settings', icon: SettingsIcon },
  '/appearance': { label: 'Appearance', icon: PaletteIcon },
  '/people': { label: 'Directory', icon: UsersRoundIcon },
  '/people/time-off': { label: 'Time off', icon: PalmtreeIcon },
  '/people/attendance': { label: 'Attendance', icon: TimerIcon },
  '/people/approvals': { label: 'Approvals', icon: ClipboardCheckIcon },
  '/people/departments': { label: 'Departments', icon: Building2Icon },
  '/people/leave-types': { label: 'Leave types', icon: TagsIcon },
};

const DYNAMIC: { pattern: RegExp; describe: (match: RegExpExecArray) => TabDescription }[] = [
  { pattern: /^\/l\/([^/]+)$/, describe: (m) => ({ label: 'List', icon: ListIcon, entity: { kind: 'list', id: m[1]! } }) },
  { pattern: /^\/p\/([^/]+)(?:\/([a-z]+))?$/, describe: (m) => ({ label: 'Project', icon: FolderKanbanIcon, entity: { kind: 'space', id: m[1]!, view: m[2] ?? '' } }) },
  { pattern: /^\/chat\/([^/]+)$/, describe: (m) => ({ label: 'Chat', icon: MessagesSquareIcon, entity: { kind: 'channel', id: m[1]! } }) },
  { pattern: /^\/docs\/([^/]+)$/, describe: (m) => ({ label: 'Doc', icon: FileTextIcon, entity: { kind: 'document', id: m[1]! } }) },
  { pattern: /^\/sprints\/([^/]+)$/, describe: (m) => ({ label: 'Sprint', icon: RocketIcon, entity: { kind: 'sprint', id: m[1]! } }) },
  { pattern: /^\/s\/([^/]+)\/sprints$/, describe: (m) => ({ label: 'Sprints', icon: RocketIcon, entity: { kind: 'space', id: m[1]!, view: 'sprints' } }) },
];

/** Label and icon for an in-app path such as `/w/<id>/docs/<docId>?task=…`. */
export function describePath(path: string): TabDescription {
  const page = (path.split(/[?#]/)[0] ?? '').replace(/^\/w\/[^/]+/, '').replace(/\/$/, '');
  const fixed = PAGES[page];
  if (fixed) return fixed;
  for (const { pattern, describe } of DYNAMIC) {
    const match = pattern.exec(page);
    if (match) return describe(match);
  }
  return { label: 'Page', icon: SquareIcon };
}
