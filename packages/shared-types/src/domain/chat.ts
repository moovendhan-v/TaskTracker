/** Chat (D1): channels, direct messages and one level of threads. See docs/plan/D1_CHAT.md. */

export const CHAT_CHANNEL_KINDS = ['public', 'private', 'dm'] as const;
export type ChatChannelKind = (typeof CHAT_CHANNEL_KINDS)[number];

export const CHAT_MEMBER_ROLES = ['owner', 'member'] as const;
export type ChatMemberRole = (typeof CHAT_MEMBER_ROLES)[number];

export const CHAT_MESSAGE_MAX = 4_000;
export const CHAT_CHANNEL_NAME_MAX = 80;
export const CHAT_TOPIC_MAX = 250;
/** People in a direct message, you included. */
export const CHAT_DM_MIN = 2;
export const CHAT_DM_MAX = 8;
export const CHAT_CHANNEL_MEMBERS_MAX = 500;
export const CHAT_ADD_MEMBERS_MAX = 50;
export const CHAT_PAGE_MAX = 50;
export const CHAT_THREAD_PAGE_MAX = 100;

/** Lowercase letters, digits, `-` and `_`, starting with a letter or digit. */
export const CHAT_CHANNEL_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

/** Turns what someone typed ("Sprint 14 Planning!") into a channel name ("sprint-14-planning"). */
export function normalizeChannelName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[\s.]+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|-+$/g, '')
    .slice(0, CHAT_CHANNEL_NAME_MAX);
}

export function isValidChannelName(name: string): boolean {
  return CHAT_CHANNEL_NAME_PATTERN.test(name);
}

/** A message body after trimming, or null when it is empty or too long. */
export function cleanMessageBody(body: string): string | null {
  const trimmed = body.trim();
  return trimmed.length === 0 || trimmed.length > CHAT_MESSAGE_MAX ? null : trimmed;
}

/** The title a task created from a message starts with: its first non-empty line, shortened. */
export function taskTitleFromMessage(body: string, max = 200): string {
  const line = body.split('\n').map((part) => part.trim()).find(Boolean) ?? '';
  const plain = line.replace(/^[#>*\-\s]+/, '').replace(/[*_`]/g, '').trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
