import type { WorkspaceTab } from '@taskflow/shared-types';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowRightIcon, PinIcon, PinOffIcon, PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useState, type DragEvent, type MouseEvent } from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { describePath } from '@/core/workbench/describe-path';
import { activeTab, closeOthers, closeTab, cycleTarget, followNavigation, homePath, newTabId, nthTab, nudgeTab, openTab, tabsOf, togglePin, moveTab, workspaceOfPath } from '@/core/workbench/tabs';
import { useWorkbenchSync } from '@/core/workbench/use-workbench-sync';
import { useWorkbenchStore } from '@/core/workbench/workbench.store';
import { cn } from '@/lib/cn';
import { useDocument } from '@/modules/documents';
import { useList } from '@/modules/lists';
import { VIEW_META, isProjectView } from '@/modules/projects';
import { useSpaces } from '@/modules/spaces';
import { useSprint } from '@/modules/sprints';

const DRAG_TYPE = 'application/x-taskflow-tab';

/** Shortcut labels. Browsers keep ⌘T / ⌘W for themselves, so the workbench uses Alt (Option on a Mac). */
const KEYS = { newTab: 'Alt T', close: 'Alt W', jump: 'Alt 1–9', cycle: 'Alt ⇧ [ ]' } as const;

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/* Each resolver loads one record and gives the tab its real name ("Product · Board", a doc title…). */

function SpaceTitle({ workspaceId, tab, spaceId, view }: { workspaceId: string; tab: WorkspaceTab; spaceId: string; view: string }) {
  const name = useSpaces(workspaceId).data?.find((space) => space.id === spaceId)?.name;
  return <Rename tab={tab} title={name ? (isProjectView(view) ? `${name} · ${VIEW_META[view].label}` : name) : undefined} />;
}
function ListTitle({ workspaceId, tab, listId }: { workspaceId: string; tab: WorkspaceTab; listId: string }) {
  return <Rename tab={tab} title={useList(workspaceId, listId).data?.name} />;
}
function DocumentTitle({ workspaceId, tab, documentId }: { workspaceId: string; tab: WorkspaceTab; documentId: string }) {
  return <Rename tab={tab} title={useDocument(workspaceId, documentId).data?.title} />;
}
function SprintTitle({ workspaceId, tab, sprintId }: { workspaceId: string; tab: WorkspaceTab; sprintId: string }) {
  return <Rename tab={tab} title={useSprint(workspaceId, sprintId).data?.name} />;
}
function Rename({ tab, title }: { tab: WorkspaceTab; title: string | undefined }) {
  const rename = useWorkbenchStore((state) => state.rename);
  const trimmed = title?.trim().slice(0, 120);
  useEffect(() => {
    if (trimmed) rename(tab.id, trimmed);
  }, [rename, tab.id, trimmed]);
  return null;
}

function TitleResolver({ workspaceId, tab }: { workspaceId: string; tab: WorkspaceTab }) {
  const entity = describePath(tab.path).entity;
  switch (entity?.kind) {
    case 'space':
      return <SpaceTitle workspaceId={workspaceId} tab={tab} spaceId={entity.id} view={entity.view} />;
    case 'list':
      return <ListTitle workspaceId={workspaceId} tab={tab} listId={entity.id} />;
    case 'document':
      return <DocumentTitle workspaceId={workspaceId} tab={tab} documentId={entity.id} />;
    case 'sprint':
      return <SprintTitle workspaceId={workspaceId} tab={tab} sprintId={entity.id} />;
    default:
      return null;
  }
}

interface TabItemProps {
  tab: WorkspaceTab;
  active: boolean;
  dropTarget: boolean;
  onSelect: () => void;
  onClose: () => void;
  onPin: () => void;
  onCloseOthers: () => void;
  onNudge: (step: -1 | 1) => void;
  onDragStart: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onDragEnd: () => void;
}

function TabItem({ tab, active, dropTarget, onSelect, onClose, onPin, onCloseOthers, onNudge, ...drag }: TabItemProps) {
  const { icon: Icon } = describePath(tab.path);
  const select = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks open a real browser tab or window.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="listitem"
          draggable
          onDragStart={drag.onDragStart}
          onDragOver={drag.onDragOver}
          onDrop={drag.onDrop}
          onDragEnd={drag.onDragEnd}
          // Middle click closes, as in a browser.
          onMouseDown={(event) => event.button === 1 && event.preventDefault()}
          onAuxClick={(event) => {
            if (event.button !== 1) return;
            event.preventDefault();
            onClose();
          }}
          className={cn(
            'group relative top-px flex h-[34px] min-w-0 shrink-0 items-center rounded-t-[9px] border border-b-0 text-[12.5px] transition-colors',
            active ? 'border-border bg-background text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            tab.pinned ? 'w-[34px] justify-center' : 'max-w-[210px] pr-1',
            dropTarget && 'before:absolute before:inset-y-1.5 before:-left-px before:w-0.5 before:rounded-full before:bg-ring',
          )}
        >
          {active ? <span aria-hidden className="absolute inset-x-2 -top-px h-0.5 rounded-b-full bg-ring" /> : null}
          <a
            href={tab.path}
            onClick={select}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.pinned ? `${tab.title} (pinned)` : undefined}
            title={tab.title}
            className={cn('flex h-full min-w-0 items-center gap-[7px] rounded-t-[9px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset', tab.pinned ? 'justify-center px-2' : 'flex-1 pl-2.5')}
          >
            <Icon aria-hidden className={cn('size-[15px] shrink-0', active ? 'text-ring' : 'text-subtle-foreground')} />
            {tab.pinned ? null : <span className="truncate">{tab.title}</span>}
          </a>
          {tab.pinned ? null : (
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${tab.title}`}
              className={cn(
                'ml-1 grid size-5 shrink-0 place-items-center rounded text-subtle-foreground hover:bg-selected hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onPin}>
          {tab.pinned ? <PinOffIcon /> : <PinIcon />} {tab.pinned ? 'Unpin tab' : 'Pin tab'}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onNudge(-1)}>
          <ArrowLeftIcon /> Move left
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onNudge(1)}>
          <ArrowRightIcon /> Move right
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onClose} shortcut={active ? KEYS.close : undefined}>
          <XIcon /> Close tab
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseOthers}>Close other tabs</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * The workbench tab strip (design: TF2 Tabs). Every page in the workspace opens in a tab;
 * tabs can be pinned, reordered, closed and are restored on the next sign-in on any device.
 */
export function WorkbenchTabs({ workspaceId }: { workspaceId: string }) {
  useWorkbenchSync();
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location.pathname + state.location.searchStr });
  const hydrated = useWorkbenchStore((state) => state.hydrated);
  const allTabs = useWorkbenchStore((state) => state.tabs);
  const activeIds = useWorkbenchStore((state) => state.active);
  const tabsState = { tabs: allTabs, active: activeIds };
  const apply = useWorkbenchStore((state) => state.apply);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const tabs = tabsOf(tabsState, workspaceId);
  const current = activeTab(tabsState, workspaceId);

  // The page changed (link, back button, redirect): the tabs follow.
  useEffect(() => {
    if (!hydrated || workspaceOfPath(location) !== workspaceId) return;
    apply((state) => {
      const existing = tabsOf(state, workspaceId).find((tab) => tab.path === location);
      return followNavigation(state, workspaceId, location, existing?.title ?? describePath(location).label, newTabId);
    });
  }, [hydrated, location, workspaceId, apply]);

  const go = (path: string) => router.history.push(path);
  const select = (tab: WorkspaceTab) => {
    apply((state) => ({ ...state, active: { ...state.active, [workspaceId]: tab.id } }));
    if (tab.path !== location) go(tab.path);
  };
  const close = (tab: WorkspaceTab) => {
    const result = closeTab(useWorkbenchStore.getState(), workspaceId, tab.id, newTabId);
    apply(() => result.state);
    if (result.navigateTo) go(result.navigateTo);
  };
  const newTab = () => {
    const path = homePath(workspaceId);
    apply((state) => openTab(state, workspaceId, { id: newTabId(), path, title: 'Home', pinned: false }));
    if (path !== location) go(path);
  };

  // Keyboard: Alt+T new, Alt+W close, Alt+1–9 jump (9 = last), Alt+Shift+[ / ] previous / next.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey || isEditable(event.target)) return;
      const state = useWorkbenchStore.getState();
      const active = activeTab(state, workspaceId);
      let target: WorkspaceTab | undefined;
      if (event.code === 'KeyT' && !event.shiftKey) {
        event.preventDefault();
        newTab();
        return;
      }
      if (event.code === 'KeyW' && !event.shiftKey && active) {
        event.preventDefault();
        close(active);
        return;
      }
      const digit = /^Digit([1-9])$/.exec(event.code)?.[1];
      if (digit && !event.shiftKey) target = nthTab(state, workspaceId, Number(digit));
      if (event.shiftKey && event.code === 'BracketLeft') target = cycleTarget(state, workspaceId, -1);
      if (event.shiftKey && event.code === 'BracketRight') target = cycleTarget(state, workspaceId, 1);
      if (!target) return;
      event.preventDefault();
      select(target);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dragHandlers = (tab: WorkspaceTab) => ({
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(DRAG_TYPE, tab.id);
      event.dataTransfer.effectAllowed = 'move';
      setDragging(tab.id);
    },
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(DRAG_TYPE) || !dragging || dragging === tab.id) return;
      const source = tabs.find((candidate) => candidate.id === dragging);
      if (source?.pinned !== tab.pinned) return;
      event.preventDefault();
      setDropTarget(tab.id);
    },
    onDrop: (event: DragEvent) => {
      const id = event.dataTransfer.getData(DRAG_TYPE);
      event.preventDefault();
      if (id) apply((state) => moveTab(state, id, tab.id));
      setDropTarget(null);
      setDragging(null);
    },
    onDragEnd: () => {
      setDropTarget(null);
      setDragging(null);
    },
  });

  const pinned = tabs.filter((tab) => tab.pinned);
  const open = tabs.filter((tab) => !tab.pinned);
  const item = (tab: WorkspaceTab) => (
    <TabItem
      key={tab.id}
      tab={tab}
      active={tab.id === current?.id}
      dropTarget={dropTarget === tab.id}
      onSelect={() => select(tab)}
      onClose={() => close(tab)}
      onPin={() => apply((state) => togglePin(state, tab.id))}
      onCloseOthers={() => apply((state) => closeOthers(state, workspaceId, tab.id))}
      onNudge={(step) => apply((state) => nudgeTab(state, workspaceId, tab.id, step))}
      {...dragHandlers(tab)}
    />
  );

  return (
    <nav aria-label="Open tabs" className="flex h-[42px] shrink-0 items-end gap-0.5 border-b bg-rail pr-2.5 pl-2">
      {tabs.map((tab) => (
        <TitleResolver key={tab.id} workspaceId={workspaceId} tab={tab} />
      ))}
      <div role="list" className="flex min-w-0 items-end gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {pinned.map(item)}
        {pinned.length && open.length ? <span aria-hidden className="mx-1.5 mb-3 h-[18px] w-px shrink-0 bg-border-strong" /> : null}
        {open.map(item)}
      </div>
      <Tooltip label={`New tab · ${KEYS.newTab}`} side="bottom">
        <button
          type="button"
          onClick={newTab}
          aria-label="New tab"
          className="mb-[5px] grid size-8 shrink-0 place-items-center rounded-md text-subtle-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <PlusIcon className="size-[17px]" />
        </button>
      </Tooltip>
    </nav>
  );
}
