import type { ChatChannelResponse, ChatMessageResponse } from '@taskflow/shared-types';

/** "#platform", or the other people's names for a direct message. */
export function channelLabel(channel: Pick<ChatChannelResponse, 'kind' | 'name' | 'dmMembers'>): string {
  if (channel.kind !== 'dm') return `#${channel.name ?? ''}`;
  const names = channel.dmMembers.map((person) => person.name);
  if (names.length === 0) return 'Just you';
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
}

/** Messages from the same person within five minutes are shown as one group. */
const GROUP_GAP_MS = 5 * 60_000;

export interface MessageRow {
  message: ChatMessageResponse;
  /** Starts a new group: show the avatar and name. */
  head: boolean;
  /** A date line goes above this message. */
  day: string | null;
}

const dayKey = (iso: string) => new Date(iso).toDateString();

export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }) });
}

/** Oldest-first messages → rows with group heads and day lines. */
export function toRows(messages: readonly ChatMessageResponse[], now = new Date()): MessageRow[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
    const head =
      newDay ||
      !previous ||
      previous.authorId !== message.authorId ||
      previous.kind !== message.kind ||
      message.kind === 'system' ||
      new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > GROUP_GAP_MS;
    return { message, head, day: newDay ? dayLabel(message.createdAt, now) : null };
  });
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
