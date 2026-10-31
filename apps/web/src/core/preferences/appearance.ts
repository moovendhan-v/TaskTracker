import { DEFAULT_PREFERENCES, readPreferences, type UserPreferences } from '@taskflow/shared-types';

const SNAPSHOT_KEY = 'taskflow.appearance';

export type Appearance = Pick<UserPreferences, 'theme' | 'accent' | 'density' | 'radius' | 'font'>;

const pickAppearance = ({ theme, accent, density, radius, font }: Appearance): Appearance => ({ theme, accent, density, radius, font });

/**
 * The last appearance this browser saw, so the first paint before preferences
 * load (and the sign-in page) already looks right. The server copy wins as soon
 * as it arrives. Browser storage may be unavailable; then defaults apply.
 */
export function storedAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return pickAppearance(raw ? readPreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES);
  } catch {
    return pickAppearance(DEFAULT_PREFERENCES);
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

/** Puts the appearance on <html>: the `dark` class plus data-accent, -density, -radius and -font for the CSS tokens. */
export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolvedTheme(appearance.theme) === 'dark');
  root.dataset['accent'] = appearance.accent;
  root.dataset['density'] = appearance.density;
  root.dataset['radius'] = appearance.radius;
  root.dataset['font'] = appearance.font;
  rememberAppearance(pickAppearance(appearance));
}
