import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * What's picked on a dashboard page (the design's "context bus"): one person or
 * one project, chosen by clicking a row in a block. Blocks set to follow the
 * page narrow to it. It's per viewer and per visit, never saved.
 */
export type PageSelection = { kind: 'person'; id: string; name: string } | { kind: 'project'; id: string; name: string };

interface PageSelectionValue {
  selection: PageSelection | null;
  /** Picks a person or project; picking the same one again clears it. */
  select: (next: PageSelection) => void;
  clear: () => void;
  /** Which kinds this page can follow (a project page is already one project). */
  kinds: readonly PageSelection['kind'][];
}

const PageSelectionContext = createContext<PageSelectionValue | null>(null);

export function PageSelectionProvider({ kinds, children }: { kinds: readonly PageSelection['kind'][]; children: ReactNode }) {
  const [selection, setSelection] = useState<PageSelection | null>(null);
  const value = useMemo<PageSelectionValue>(
    () => ({
      selection,
      select: (next) => setSelection((current) => (current?.kind === next.kind && current.id === next.id ? null : next)),
      clear: () => setSelection(null),
      kinds,
    }),
    [selection, kinds],
  );
  return <PageSelectionContext.Provider value={value}>{children}</PageSelectionContext.Provider>;
}

/** The page's selection, or null outside a dashboard page. */
export function usePageSelection(): PageSelectionValue | null {
  return useContext(PageSelectionContext);
}

/** A row's select handler and pressed state, when this page can follow that kind. */
export function useSelectable(kind: PageSelection['kind']) {
  const page = usePageSelection();
  if (!page || !page.kinds.includes(kind)) return null;
  return {
    isSelected: (id: string) => page.selection?.kind === kind && page.selection.id === id,
    select: (id: string, name: string) => page.select({ kind, id, name }),
  };
}

/** Kinds each page can follow: Home has people and projects; a project page is already one project. */
export const HOME_SELECTION_KINDS = ['person', 'project'] as const satisfies readonly PageSelection['kind'][];
export const PROJECT_SELECTION_KINDS = ['person'] as const satisfies readonly PageSelection['kind'][];
