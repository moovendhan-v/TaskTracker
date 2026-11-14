import { useState } from 'react';

/**
 * A choice remembered in this browser under `key` (e.g. a view option), kept to
 * the allowed values. Works without storage too (private windows): it just
 * isn't remembered then.
 */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback;
    } catch {
      return fallback;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // Not remembered; the choice still applies now.
    }
  };
  return [value, set];
}
