import { CHAT_USER_MENTION, mentionToken } from '@taskflow/shared-types';

export interface Person {
  id: string;
  name: string;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The `@name` being typed just before the caret, if any. */
export function personAt(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|[\s(])@([\p{L}\p{N}._-]{0,40})$/u.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[2]!.length - 1, query: match[2]! };
}

/** What the composer shows → what's stored: each picked `@Name` becomes `@{id}`. Longer names first, so "Sam Rivera" wins over "Sam". */
export function namesToTokens(text: string, people: readonly Person[]): string {
  return [...people]
    .sort((a, b) => b.name.length - a.name.length)
    .reduce((result, person) => result.replace(new RegExp(`@${escape(person.name)}(?![\\p{L}\\p{N}_])`, 'gu'), mentionToken(person.id)), text);
}

/** What's stored → what the composer shows, plus the people it mentions (for editing a message). */
export function tokensToNames(body: string, nameOf: (id: string) => string | null): { text: string; people: Person[] } {
  const people = new Map<string, Person>();
  const text = body.replace(CHAT_USER_MENTION, (_token, id: string) => {
    const name = nameOf(id) ?? 'someone';
    people.set(id, { id, name });
    return `@${name}`;
  });
  return { text, people: [...people.values()] };
}
