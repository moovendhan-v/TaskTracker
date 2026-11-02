import { CheckCircle2Icon, ClockIcon, FileTextIcon, HomeIcon, MessagesSquareIcon, SettingsIcon, UsersRoundIcon, type LucideIcon } from 'lucide-react';

export type RailArea = 'home' | 'tracker' | 'chat' | 'docs' | 'time' | 'people' | 'workspace';

export interface RailItem {
  area: RailArea;
  label: string;
  icon: LucideIcon;
  /** Page the rail button opens, inside the workspace. */
  path: string;
  /** Second key of the "G then …" shortcut, if any. */
  goKey?: string;
}

/** The apps on the rail (design: TF2 Rail). Video and automations join when they exist. */
export const RAIL_ITEMS: readonly RailItem[] = [
  { area: 'home', label: 'Home', icon: HomeIcon, path: '', goKey: 'h' },
  { area: 'tracker', label: 'Tracker', icon: CheckCircle2Icon, path: '/my-tasks', goKey: 't' },
  { area: 'chat', label: 'Chat', icon: MessagesSquareIcon, path: '/chat', goKey: 'c' },
  { area: 'docs', label: 'Docs', icon: FileTextIcon, path: '/docs', goKey: 'd' },
  { area: 'time', label: 'Time', icon: ClockIcon, path: '/timesheets', goKey: 'm' },
  { area: 'people', label: 'People', icon: UsersRoundIcon, path: '/people', goKey: 'p' },
  { area: 'workspace', label: 'Workspace', icon: SettingsIcon, path: '/settings' },
];

const AREAS: [RegExp, RailArea][] = [
  [/^\/(my-tasks|p|l|sprints|s|t)(\/|$)/, 'tracker'],
  [/^\/chat(\/|$)/, 'chat'],
  [/^\/docs(\/|$)/, 'docs'],
  [/^\/(timesheets|daily-log)(\/|$)/, 'time'],
  [/^\/people(\/|$)/, 'people'],
  [/^\/(settings|members|roles|audit-log)(\/|$)/, 'workspace'],
];

/** Which rail app a workspace path belongs to; null for pages outside them (inbox, appearance). */
export function railAreaOf(pathname: string): RailArea | null {
  const page = pathname.replace(/^\/w\/[^/]+/, '').replace(/\/$/, '');
  if (page === '') return 'home';
  return AREAS.find(([pattern]) => pattern.test(page))?.[1] ?? null;
}

/** "G then key" shortcuts: G I opens the inbox, the rest come from the rail items. */
export function goToPath(key: string): string | null {
  if (key === 'i') return '/inbox';
  return RAIL_ITEMS.find((item) => item.goKey === key)?.path ?? null;
}
