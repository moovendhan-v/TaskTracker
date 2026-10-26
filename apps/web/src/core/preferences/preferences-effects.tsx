import { useEffect } from 'react';
import { applyAppearance } from './appearance';
import { usePreferences } from './use-preferences';

/** Applies the signed-in user's appearance and follows the OS theme while it's set to "system". */
export function PreferencesEffects() {
  const { theme, accent, density } = usePreferences();

  useEffect(() => {
    applyAppearance({ theme, accent, density });
    if (theme !== 'system') return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const follow = () => applyAppearance({ theme, accent, density });
    media?.addEventListener('change', follow);
    return () => media?.removeEventListener('change', follow);
  }, [theme, accent, density]);

  return null;
}
