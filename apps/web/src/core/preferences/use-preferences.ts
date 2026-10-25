import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_PREFERENCES, type PreferenceSettings, type UserPreferences } from '@taskflow/shared-types';
import { preferencesApi } from '@/core/api/preferences.api';
import { storedAppearance } from './appearance';

export const PREFERENCES_KEY = ['preferences'] as const;

export const preferencesQuery = {
  queryKey: PREFERENCES_KEY,
  queryFn: preferencesApi.get,
  staleTime: 5 * 60_000,
} as const;

/** The signed-in user's preferences; until they load, the last appearance this browser saw plus defaults. */
export function usePreferences(): UserPreferences {
  const { data } = useQuery(preferencesQuery);
  return data ?? { ...DEFAULT_PREFERENCES, ...storedAppearance() };
}

/**
 * Changes and saves preferences. Each change shows at once (optimistic) and the
 * server's answer replaces it; on failure the previous value comes back.
 */
/** A preferences mutation that shows its result at once and rolls back if the server refuses it. */
function useOptimisticPreference<T>(apply: (current: UserPreferences, input: T) => UserPreferences, send: (input: T) => Promise<UserPreferences>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onMutate: async (input: T) => {
      await queryClient.cancelQueries({ queryKey: PREFERENCES_KEY });
      const previous = queryClient.getQueryData<UserPreferences>(PREFERENCES_KEY);
      if (previous) queryClient.setQueryData(PREFERENCES_KEY, apply(previous, input));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(PREFERENCES_KEY, context.previous);
    },
    onSuccess: (saved) => queryClient.setQueryData(PREFERENCES_KEY, saved),
  });
}

export function usePreferenceMutations() {
  const queryClient = useQueryClient();
  return {
    update: useOptimisticPreference((current, input: Partial<PreferenceSettings>) => ({ ...current, ...input }), preferencesApi.update),
    saveTable: useOptimisticPreference(
      (current, input: Parameters<typeof preferencesApi.saveTable>[0]) => ({
        ...current,
        tables: [
          ...current.tables.filter((table) => table.key !== input.key),
          { ...input, pageSize: input.pageSize ?? null, sort: input.sort?.map((sort) => ({ field: sort.field, direction: sort.direction ?? 'asc' })) ?? null },
        ],
      }),
      preferencesApi.saveTable,
    ),
    resetTable: useOptimisticPreference((current, key: string) => ({ ...current, tables: current.tables.filter((table) => table.key !== key) }), preferencesApi.resetTable),
    saveView: useMutation({ mutationFn: preferencesApi.saveView, onSuccess: (saved) => queryClient.setQueryData(PREFERENCES_KEY, saved) }),
    deleteView: useOptimisticPreference((current, viewId: string) => ({ ...current, savedViews: current.savedViews.filter((view) => view.id !== viewId) }), preferencesApi.deleteView),
    setTabs: useOptimisticPreference(
      (current, tabs: Parameters<typeof preferencesApi.setTabs>[0]) => ({ ...current, tabs: tabs.map((tab) => ({ ...tab, pinned: tab.pinned ?? false })) }),
      preferencesApi.setTabs,
    ),
    reset: useMutation({ mutationFn: preferencesApi.reset, onSuccess: (saved) => queryClient.setQueryData(PREFERENCES_KEY, saved) }),
  };
}
