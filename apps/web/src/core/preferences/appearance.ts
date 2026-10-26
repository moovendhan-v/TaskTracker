import { DEFAULT_PREFERENCES, readPreferences, type UserPreferences } from '@taskflow/shared-types';

const SNAPSHOT_KEY = 'taskflow.appearance';

type Appearance = Pick<UserPreferences, 'theme' | 'accent' | 'density'>;

/**
 * The last appearance this browser saw, so the first paint before preferences
 * load (and the sign-in page) already looks right. The server copy wins as soon
 * as it arrives. Browser storage may be unavailable; then defaults apply.
 */
export function storedAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    const stored = raw ? readPreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES;
    return { theme: stored.theme, accent: stored.accent, density: stored.density };
  } catch {
    return { theme: DEFAULT_PREFERENCES.theme, accent: DEFAULT_PREFERENCES.accent, density: DEFAULT_PREFERENCES.density };
  }
}

function rememberAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(appearance));
  } catch {
    // Private mode or storage disabled: the server copy still applies after load.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Light or dark after resolving "system". */
export function resolvedTheme(theme: Appearance['theme']): 'light' | 'dark' {
  return theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme;
}

/** Puts the appearance on <html>: the `dark` class plus data-accent and data-density for the CSS tokens. */
export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolvedTheme(appearance.theme) === 'dark');
  root.dataset['accent'] = appearance.accent;
  root.dataset['density'] = appearance.density;
  rememberAppearance(appearance);
}
