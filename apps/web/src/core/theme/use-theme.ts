import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: systemTheme(),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'taskflow.theme', storage: createJSONStorage(() => localStorage) },
  ),
);

/** Keeps the `dark` class on <html> in sync with the stored theme. */
export function syncThemeClass(): void {
  const apply = (theme: Theme) => document.documentElement.classList.toggle('dark', theme === 'dark');
  apply(useTheme.getState().theme);
  useTheme.subscribe((state) => apply(state.theme));
}
