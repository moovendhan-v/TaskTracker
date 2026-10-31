import { useQuery } from '@tanstack/react-query';
import type { WorkspaceTab } from '@taskflow/shared-types';
import { useEffect } from 'react';
import { usePreferenceMutations, preferencesQuery } from '@/core/preferences/use-preferences';
import { useWorkbenchStore } from './workbench.store';

const SAVE_DELAY_MS = 800;

const same = (a: readonly WorkspaceTab[], b: readonly WorkspaceTab[]) =>
  a.length === b.length && a.every((tab, i) => tab.id === b[i]!.id && tab.path === b[i]!.path && tab.title === b[i]!.title && tab.pinned === b[i]!.pinned);

/** Loads the account's tabs once, then saves changes (debounced) so they follow the user to other devices. */
export function useWorkbenchSync(): void {
  const { data: preferences } = useQuery(preferencesQuery);
  const { setTabs } = usePreferenceMutations();
  const hydrate = useWorkbenchStore((state) => state.hydrate);
  const hydrated = useWorkbenchStore((state) => state.hydrated);
  const tabs = useWorkbenchStore((state) => state.tabs);

  useEffect(() => {
    if (preferences) hydrate(preferences.tabs);
  }, [preferences, hydrate]);

  const saved = preferences?.tabs;
  const { mutate } = setTabs;
  useEffect(() => {
    if (!hydrated || !saved || same(tabs, saved)) return;
    const timer = setTimeout(() => mutate(tabs.map(({ id, path, title, pinned }) => ({ id, path, title, pinned }))), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hydrated, tabs, saved, mutate]);
}
