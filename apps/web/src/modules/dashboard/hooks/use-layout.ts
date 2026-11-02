import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BLOCK_TYPES_BY_PAGE, cleanLayoutItem, DEFAULT_LAYOUTS, validateLayoutItems, type LayoutItem, type LayoutPage } from '@taskflow/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage, isConflict } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { dashboardsApi, layoutsApi } from '../api/layouts.api';
import { arrange } from '../lib/grid';

const SAVE_DELAY_MS = 800;
const HISTORY = 30;

/**
 * Saved items exactly as the user left them, minus any block type this version of
 * the app doesn't know. Only a layout that breaks the rules gets re-packed.
 */
function usable(pageKey: LayoutPage, items: readonly LayoutItem[] | undefined): LayoutItem[] {
  if (!items) return DEFAULT_LAYOUTS[pageKey];
  const known = items.filter((item) => BLOCK_TYPES_BY_PAGE[pageKey].includes(item.type)).map(cleanLayoutItem);
  return validateLayoutItems(pageKey, known).length ? arrange(known) : known;
}

interface SavedLayout {
  version: number | null;
  items: LayoutItem[];
}

/** Where a layout lives: the personal per-page layout, or one named dashboard. */
interface LayoutSource {
  key: readonly unknown[];
  pageKey: LayoutPage;
  /** null when nothing is saved yet (the default applies). */
  fetch: () => Promise<SavedLayout | null>;
  save: (baseVersion: number | null, items: LayoutItem[]) => Promise<SavedLayout>;
  /** Back to the default blocks; returns the version to continue from. */
  reset: () => Promise<number | null>;
}

/** The user's own layout for a page (Home → Overview). */
export function useLayout(workspaceId: string, pageKey: LayoutPage) {
  return useArrangeableLayout({
    key: queryKeys.layout(workspaceId, pageKey),
    pageKey,
    fetch: () => layoutsApi.get(workspaceId, pageKey),
    save: (baseVersion, items) => layoutsApi.save(workspaceId, pageKey, baseVersion, items),
    reset: async () => {
      await layoutsApi.reset(workspaceId, pageKey);
      return null;
    },
  });
}

/** One named dashboard's blocks (only its owner edits them). */
export function useDashboardLayout(workspaceId: string, dashboardId: string) {
  const find = async () => (await dashboardsApi.list(workspaceId)).find((dashboard) => dashboard.id === dashboardId) ?? null;
  return useArrangeableLayout({
    key: [...queryKeys.dashboards(workspaceId), dashboardId, 'layout'],
    pageKey: 'home',
    fetch: find,
    save: (baseVersion, items) => dashboardsApi.saveLayout(workspaceId, dashboardId, baseVersion ?? 1, items),
    reset: async () => {
      const current = await find();
      return (await dashboardsApi.saveLayout(workspaceId, dashboardId, current?.version ?? 1, DEFAULT_LAYOUTS.home)).version;
    },
  });
}

/**
 * A layout being arranged. Edits show at once and save after a pause, carrying the
 * version they started from. If another device saved in between, the user picks:
 * keep this layout (saved on top) or use the other one (spec §4.4).
 */
function useArrangeableLayout(source: LayoutSource) {
  const { key, pageKey } = source;
  const keyId = JSON.stringify(key);
  const queryClient = useQueryClient();
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });
  const query = useQuery({ queryKey: key, queryFn: () => sourceRef.current.fetch(), staleTime: 60_000 });
  const [items, setItemsState] = useState<LayoutItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const version = useRef<number | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useRef<LayoutItem[][]>([]);
  const [undoable, setUndoable] = useState(0);
  const latest = useRef<LayoutItem[] | null>(null);
  const saveAgain = useRef<(items: LayoutItem[]) => Promise<void>>(async () => {});

  // Take the server copy the first time it arrives (or after "Use other").
  useEffect(() => {
    if (query.data === undefined || items !== null) return;
    version.current = query.data?.version ?? null;
    latest.current = usable(pageKey, query.data?.items);
    setItemsState(latest.current);
  }, [query.data, items, pageKey]);

  const save = useCallback(
    async (next: LayoutItem[]) => {
      if (validateLayoutItems(pageKey, next).length) return;
      setSaving(true);
      try {
        const saved = await sourceRef.current.save(version.current, next);
        version.current = saved.version;
        queryClient.setQueryData<SavedLayout | null>(key, saved);
      } catch (error) {
        if (!isConflict(error)) {
          toast.error(`Couldn't save the layout. ${getErrorMessage(error)}`);
          return;
        }
        toast('Layout changed on another device', {
          duration: Infinity,
          action: {
            label: 'Keep this',
            onClick: () => {
              void sourceRef.current.fetch().then((newest) => {
                version.current = newest?.version ?? null;
                void saveAgain.current(next);
              });
            },
          },
          cancel: {
            label: 'Use other',
            onClick: () => {
              void queryClient.fetchQuery({ queryKey: key, queryFn: () => sourceRef.current.fetch(), staleTime: 0 }).then((other) => {
                version.current = other?.version ?? null;
                history.current = [];
                setUndoable(0);
                latest.current = usable(pageKey, other?.items);
                setItemsState(latest.current);
              });
            },
          },
        });
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key identifies the source; sourceRef holds its functions
    [keyId, pageKey, queryClient],
  );

  useEffect(() => {
    saveAgain.current = save;
  }, [save]);

  const setItems = useCallback(
    (next: LayoutItem[], { remember = true }: { remember?: boolean } = {}) => {
      const current = latest.current;
      if (remember && current) history.current = [...history.current.slice(-(HISTORY - 1)), current];
      setUndoable(history.current.length);
      latest.current = next;
      setItemsState(next);
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        pending.current = null;
        void save(next);
      }, SAVE_DELAY_MS);
    },
    [save],
  );

  const undo = useCallback(() => {
    const previous = history.current.pop();
    if (previous) setItems(previous, { remember: false });
    setUndoable(history.current.length);
    return Boolean(previous);
  }, [setItems]);

  const reset = useCallback(async () => {
    if (pending.current) clearTimeout(pending.current);
    try {
      version.current = await sourceRef.current.reset();
      history.current = [];
      setUndoable(0);
      void queryClient.invalidateQueries({ queryKey: key });
      latest.current = DEFAULT_LAYOUTS[pageKey];
      setItemsState(latest.current);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key identifies the source; sourceRef holds its functions
  }, [keyId, pageKey, queryClient]);

  // Leaving the page with a change still waiting: save it now rather than drop it.
  useEffect(
    () => () => {
      if (!pending.current || !latest.current) return;
      clearTimeout(pending.current);
      void save(latest.current);
    },
    [save],
  );

  return {
    pageKey,
    items: items ?? (query.isError ? DEFAULT_LAYOUTS[pageKey] : null),
    setItems,
    undo,
    canUndo: undoable > 0,
    reset,
    saving,
    isCustom: Boolean(query.data),
  };
}

/** What the grid needs from a layout, whichever source it comes from. */
export type ArrangeableLayout = ReturnType<typeof useLayout>;
