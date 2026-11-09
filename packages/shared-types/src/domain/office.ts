/** D3: the virtual office. See docs/plan/D3_OFFICE.md. */

export const OFFICE_WIDTH = 24;
export const OFFICE_HEIGHT = 14;

export const OFFICE_ZONE_KINDS = ['desks', 'focus', 'lounge', 'meeting'] as const;
export type OfficeZoneKind = (typeof OFFICE_ZONE_KINDS)[number];

export interface OfficeZone {
  id: string;
  kind: OfficeZoneKind;
  name: string;
  /** Top-left tile and size, in tiles. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The floor every workspace starts with. Tiles outside every zone are corridor (walkable). */
export const OFFICE_ZONES: readonly OfficeZone[] = [
  { id: 'desks', kind: 'desks', name: 'Open desks', x: 1, y: 1, w: 10, h: 6 },
  { id: 'focus', kind: 'focus', name: 'Focus area', x: 1, y: 8, w: 7, h: 5 },
  { id: 'lounge', kind: 'lounge', name: 'Lounge', x: 9, y: 8, w: 6, h: 5 },
  { id: 'aurora', kind: 'meeting', name: 'Aurora', x: 13, y: 1, w: 5, h: 4 },
  { id: 'borealis', kind: 'meeting', name: 'Borealis', x: 19, y: 1, w: 4, h: 4 },
  { id: 'cosmos', kind: 'meeting', name: 'Cosmos', x: 17, y: 7, w: 6, h: 6 },
];

/** Walls: the outer edge of the floor. Everything else can be stood on. */
export function isWalkable(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 1 && y >= 1 && x <= OFFICE_WIDTH - 2 && y <= OFFICE_HEIGHT - 2;
}

export function zoneAt(x: number, y: number): OfficeZone | null {
  return OFFICE_ZONES.find((zone) => x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) ?? null;
}

/** The public channel behind a meeting room: its chat and its huddle. */
export function meetingRoomChannelName(zone: OfficeZone): string {
  return `room-${zone.id}`;
}

/** What people choose; "in a meeting" and "offline" are worked out by the server. */
export const OFFICE_CHOSEN_STATUSES = ['available', 'focused', 'away'] as const;
export type OfficeChosenStatus = (typeof OFFICE_CHOSEN_STATUSES)[number];
export type OfficeStatus = OfficeChosenStatus | 'in_meeting' | 'offline';

export function isOfficeChosenStatus(value: unknown): value is OfficeChosenStatus {
  return typeof value === 'string' && (OFFICE_CHOSEN_STATUSES as readonly string[]).includes(value);
}

/** No sign of someone for this long and they show as offline. */
export const OFFICE_OFFLINE_AFTER_MS = 3 * 60_000;

/** How someone shows: offline first, then a huddle, then the focus area, then their choice. */
export function officeStatus(input: { chosen: OfficeChosenStatus; lastSeenAt: Date; inCall: boolean; x: number; y: number }, now: Date): OfficeStatus {
  if (now.getTime() - input.lastSeenAt.getTime() > OFFICE_OFFLINE_AFTER_MS) return 'offline';
  if (input.inCall) return 'in_meeting';
  if (input.chosen === 'away') return 'away';
  if (input.chosen === 'focused' || zoneAt(input.x, input.y)?.kind === 'focus') return 'focused';
  return 'available';
}

export interface OfficePersonResponse {
  userId: string;
  name: string;
  x: number;
  y: number;
  status: OfficeStatus;
  chosenStatus: OfficeChosenStatus;
  /** The zone they're standing in, if any. */
  zoneId: string | null;
}

export interface OfficeResponse {
  workspaceId: string;
  people: OfficePersonResponse[];
}
