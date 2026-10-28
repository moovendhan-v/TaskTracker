import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  ListPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
  TrashIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { DocumentSummaryResponse, FolderResponse, SpaceResponse, TaskListResponse } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EntityIcon } from '@/components/common/entity-icon';
import { NameDialog, type NameDialogValues } from '@/components/common/name-dialog';
import { SidebarLink } from '@/components/layout/sidebar-link';
import { SidebarSection } from '@/components/layout/sidebar-section';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/errors';
import { useDocumentMutations, useDocumentTree } from '@/modules/documents';
import { useFolderMutations, useFolders, useListMutations, useLists } from '@/modules/lists';
import { TemplateGallery } from '@/modules/templates';
import { usePermissions } from '@/modules/workspaces';
import { useSpaceMutations, useSpaces } from '../hooks/use-spaces';

const iconButton =
  'rounded p-0.5 text-sidebar-muted opacity-0 transition hover:bg-sidebar-border hover:text-sidebar-foreground group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100';

const onError = (error: unknown) => toast.error(getErrorMessage(error));

/** A menu that hosts dialogs stays open while they are; `done` closes it once a dialog has saved. */
function useMenu() {
  const [open, setOpen] = useState(false);
  return { open, onOpenChange: setOpen, done: () => setOpen(false) };
}

/** "No colour" comes back from the dialog as an empty string. */
const appearance = (values: NameDialogValues) => ({ name: values.name, icon: values.icon, color: values.color || null });

/** Live counts the sidebar shows under an open project. */
export interface SpaceStats {
  open: number;
  overdue: number;
  dueSoon: number;
}

interface SpaceTreeProps {
  workspaceId: string;
  stats?: Record<string, SpaceStats>;
  /** Only projects whose name contains this. */
  filter?: string;
  /** The view a project opens in (the user's default task view). */
  defaultView: string;
}

/** Sidebar tree of projects (spaces): counts, quick links, and the folders, lists and docs inside each. */
export function SpaceTree({ workspaceId, stats = {}, filter = '', defaultView }: SpaceTreeProps) {
  const { data: spaces = [] } = useSpaces(workspaceId);
  const { data: lists = [] } = useLists(workspaceId);
  const { data: folders = [] } = useFolders(workspaceId);
  const { data: docs = [] } = useDocumentTree(workspaceId);
  const { can } = usePermissions(workspaceId);
  const spaceMutations = useSpaceMutations(workspaceId);
  const newMenu = useMenu();
  const [galleryOpen, setGalleryOpen] = useState(false);

  return (
    <SidebarSection
      title="Spaces"
      action={
        can('space.manage') ? (
          <>
            <DropdownMenu open={newMenu.open} onOpenChange={newMenu.onOpenChange}>
              <DropdownMenuTrigger className="rounded p-0.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="New space">
                <PlusIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <NameDialog
                  formName="space.create"
                  trigger={
                    <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                      <PlusIcon /> Blank space
                    </DropdownMenuItem>
                  }
                  title="New space"
                  description="Spaces group related folders, lists and docs, like a team or a client."
                  submitLabel="Create space"
                  placeholder="e.g. Engineering"
                  withIcon
                  onSubmit={(values) => spaceMutations.create.mutateAsync({ name: values.name, color: values.color, icon: values.icon }).then(newMenu.done, onError)}
                />
                <DropdownMenuItem onSelect={() => setGalleryOpen(true)}>
                  <LayoutTemplateIcon /> From a template…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {galleryOpen ? <TemplateGallery workspaceId={workspaceId} open onOpenChange={setGalleryOpen} /> : null}
          </>
        ) : null
      }
    >
      {spaces.length === 0 ? <p className="px-2 py-1 text-xs text-sidebar-muted">No spaces yet.</p> : null}
      {spaces
        .filter((space) => space.name.toLowerCase().includes(filter.trim().toLowerCase()))
        .map((space) => (
          <SpaceNode
            key={space.id}
            workspaceId={workspaceId}
            space={space}
            stats={stats[space.id]}
            defaultView={defaultView}
            lists={lists.filter((list) => list.spaceId === space.id)}
            folders={folders.filter((folder) => folder.spaceId === space.id)}
            docs={docs.filter((doc) => doc.spaceId === space.id)}
          />
        ))}
    </SidebarSection>
  );
}

interface SpaceNodeProps {
  workspaceId: string;
  space: SpaceResponse;
  stats: SpaceStats | undefined;
  defaultView: string;
  lists: TaskListResponse[];
  folders: FolderResponse[];
  docs: DocumentSummaryResponse[];
}

/** Everything a node needs to render its children and act on them. */
interface TreeContext {
  workspaceId: string;
  space: SpaceResponse;
  defaultView: string;
  lists: TaskListResponse[];
  folders: FolderResponse[];
  canManage: boolean;
}

function SpaceNode({ workspaceId, space, stats, defaultView, lists, folders, docs }: SpaceNodeProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const inside = pathname.includes(`/p/${space.id}`);
  const [expanded, setExpanded] = useState(inside);
  const navigate = useNavigate();
  const spaceMutations = useSpaceMutations(workspaceId);
  const docMutations = useDocumentMutations(workspaceId);
  const { canIn } = usePermissions(workspaceId);
  const context: TreeContext = { workspaceId, space, defaultView, lists, folders, canManage: canIn(space.id, 'list.manage') };
  const addMenu = useMenu();
  const optionsMenu = useMenu();

  const newDoc = () =>
    docMutations.create.mutate(
      { title: 'Untitled', spaceId: space.id },
      { onSuccess: (created) => void navigate({ to: '/w/$workspaceId/docs/$documentId', params: { workspaceId, documentId: created.id } }) },
    );

  return (
    <div>
      <div className={cn('group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-sidebar-accent', inside && 'bg-sidebar-accent')}>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="rounded p-0.5 text-sidebar-muted" aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${space.name}`}>
          <ChevronRightIcon className={cn('size-3.5 shrink-0 transition-transform', expanded && 'rotate-90')} />
        </button>
        <Link
          to="/w/$workspaceId/p/$spaceId/$view"
          params={{ workspaceId, spaceId: space.id, view: defaultView }}
          onClick={() => setExpanded(true)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
        >
          <EntityIcon variant="badge" icon={space.icon} color={space.color} fallback={{ letter: space.name }} />
          <span className="truncate font-medium">{space.name}</span>
        </Link>
        {canIn(space.id, 'list.manage') || canIn(space.id, 'doc.create') ? (
          <DropdownMenu open={addMenu.open} onOpenChange={addMenu.onOpenChange}>
            <DropdownMenuTrigger className={iconButton} aria-label={`Add to ${space.name}`}>
              <PlusIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Add to {space.name}</DropdownMenuLabel>
              {canIn(space.id, 'list.manage') ? (
                <>
                  <NewListDialog context={context} folderId={null} onCreated={() => {
                    setExpanded(true);
                    addMenu.done();
                  }} />
                  <NewFolderDialog context={context} parentId={null} onCreated={() => {
                    setExpanded(true);
                    addMenu.done();
                  }} />
                </>
              ) : null}
              {canIn(space.id, 'doc.create') ? (
                <DropdownMenuItem
                  onSelect={() => {
                    setExpanded(true);
                    newDoc();
                  }}
                >
                  <FileTextIcon /> Doc
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {canIn(space.id, 'space.manage') ? (
          <DropdownMenu open={optionsMenu.open} onOpenChange={optionsMenu.onOpenChange}>
            <DropdownMenuTrigger className={iconButton} aria-label={`${space.name} options`}>
              <MoreHorizontalIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <NameDialog
                formName="space.update"
                trigger={
                  <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                    <PencilIcon /> Rename, icon and colour
                  </DropdownMenuItem>
                }
                title="Edit space"
                submitLabel="Save"
                withIcon
                defaultValues={{ name: space.name, color: space.color, icon: space.icon }}
                onSubmit={(values) =>
                  spaceMutations.update.mutateAsync({ spaceId: space.id, body: { name: values.name, color: values.color, icon: values.icon } }).then(optionsMenu.done, onError)
                }
              />
              <DropdownMenuItem asChild>
                <Link to="/w/$workspaceId/p/$spaceId/$view" params={{ workspaceId, spaceId: space.id, view: 'settings' }}>
                  <SettingsIcon /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                    <TrashIcon /> Delete
                  </DropdownMenuItem>
                }
                title={`Delete ${space.name}?`}
                description="All folders, lists and tasks in this space will be deleted. Its docs stay in Docs."
                confirmLabel="Delete space"
                onConfirm={() => spaceMutations.remove.mutateAsync(space.id).catch(onError)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {expanded ? (
        <div className="ml-4 grid gap-0.5 border-l border-sidebar-border pl-2">
          {stats ? (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-sidebar-muted">
              <span>{stats.open} open</span>
              {stats.overdue ? <span className="text-critical">{stats.overdue} overdue</span> : null}
              {stats.dueSoon ? <span className="text-warning">{stats.dueSoon} due soon</span> : null}
            </div>
          ) : null}
          <div className="grid gap-0.5 pb-1">
            <SidebarLink
              to="/w/$workspaceId/p/$spaceId/$view"
              params={{ workspaceId, spaceId: space.id, view: 'dashboard' }}
              icon={<LayoutDashboardIcon className="size-4 text-primary" />}
              className="py-1 text-xs"
            >
              Dashboard
            </SidebarLink>
            <SidebarLink
              to="/w/$workspaceId/p/$spaceId/$view"
              params={{ workspaceId, spaceId: space.id, view: 'sprints' }}
              icon={<RocketIcon className="size-4 text-chart-1" />}
              className="py-1 text-xs"
            >
              Sprints
            </SidebarLink>
            <SidebarLink
              to="/w/$workspaceId/p/$spaceId/$view"
              params={{ workspaceId, spaceId: space.id, view: 'time' }}
              icon={<ClockIcon className="size-4 text-warning" />}
              className="py-1 text-xs"
            >
              Time
            </SidebarLink>
          </div>
          <FolderChildren context={context} parentId={null} />
          {lists.length === 0 && folders.length === 0 ? <p className="px-2 py-1 text-xs text-sidebar-muted">No lists</p> : null}
          {docs.length > 0 ? <SpaceDocs workspaceId={workspaceId} docs={docs} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** The folders and lists directly inside a folder (or directly under the space with null). */
function FolderChildren({ context, parentId }: { context: TreeContext; parentId: string | null }) {
  const folders = context.folders.filter((folder) => folder.parentId === parentId);
  const lists = context.lists.filter((list) => list.folderId === parentId);
  return (
    <>
      {folders.map((folder) => (
        <FolderNode key={folder.id} context={context} folder={folder} />
      ))}
      {lists.map((list) => (
        <ListNode key={list.id} context={context} list={list} />
      ))}
    </>
  );
}

function FolderNode({ context, folder }: { context: TreeContext; folder: FolderResponse }) {
  const [expanded, setExpanded] = useState(true);
  const mutations = useFolderMutations(context.workspaceId);
  const addMenu = useMenu();
  const optionsMenu = useMenu();
  const empty = !context.folders.some((item) => item.parentId === folder.id) && !context.lists.some((list) => list.folderId === folder.id);

  return (
    <div>
      <div className="group flex items-center gap-1 rounded-md px-1 py-1 text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} folder ${folder.name}`}
        >
          <ChevronRightIcon className={cn('size-3 shrink-0 text-sidebar-muted transition-transform', expanded && 'rotate-90')} />
          <EntityIcon icon={folder.icon} color={folder.color} fallback={FolderIcon} className="text-sidebar-muted" />
          <span className="truncate">{folder.name}</span>
        </button>
        {context.canManage ? (
          <>
            <DropdownMenu open={addMenu.open} onOpenChange={addMenu.onOpenChange}>
              <DropdownMenuTrigger className={iconButton} aria-label={`Add to ${folder.name}`}>
                <PlusIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <NewListDialog context={context} folderId={folder.id} onCreated={() => {
                    setExpanded(true);
                    addMenu.done();
                  }} />
                <NewFolderDialog context={context} parentId={folder.id} onCreated={() => {
                    setExpanded(true);
                    addMenu.done();
                  }} />
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu open={optionsMenu.open} onOpenChange={optionsMenu.onOpenChange}>
              <DropdownMenuTrigger className={iconButton} aria-label={`${folder.name} options`}>
                <MoreHorizontalIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <NameDialog
                  formName="folder.update"
                  trigger={
                    <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                      <PencilIcon /> Rename, icon and colour
                    </DropdownMenuItem>
                  }
                  title="Edit folder"
                  submitLabel="Save"
                  withIcon="optional-color"
                  defaultValues={{ name: folder.name, color: folder.color ?? '', icon: folder.icon }}
                  onSubmit={(values) => mutations.update.mutateAsync({ folderId: folder.id, body: appearance(values) }).then(optionsMenu.done)}
                />
                <MoveMenu
                  context={context}
                  exclude={folder.id}
                  current={folder.parentId}
                  onMove={(target) => mutations.move.mutate({ folderId: folder.id, body: { parentId: target } })}
                />
                <DropdownMenuSeparator />
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                      <TrashIcon /> Delete folder
                    </DropdownMenuItem>
                  }
                  title={`Delete ${folder.name}?`}
                  description={empty ? 'The folder is empty.' : 'Only the folder goes. Its lists and folders move up a level, with their tasks.'}
                  confirmLabel="Delete folder"
                  onConfirm={() => mutations.remove.mutateAsync(folder.id)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </div>
      {expanded ? (
        <div className="ml-3 grid gap-0.5 border-l border-sidebar-border pl-2">
          <FolderChildren context={context} parentId={folder.id} />
          {empty ? <p className="px-2 py-0.5 text-xs text-sidebar-muted">Empty</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ListNode({ context, list }: { context: TreeContext; list: TaskListResponse }) {
  const mutations = useListMutations(context.workspaceId);
  const navigate = useNavigate();
  const menu = useMenu();
  const { workspaceId, space, defaultView } = context;

  return (
    <div className="group relative flex items-center">
      <SidebarLink
        to="/w/$workspaceId/p/$spaceId/$view"
        params={{ workspaceId, spaceId: space.id, view: defaultView }}
        search={{ list: list.id }}
        activeOptions={{ includeSearch: true }}
        icon={<EntityIcon icon={list.icon} color={list.color} />}
        className="min-w-0 flex-1 pr-7"
      >
        {list.name}
      </SidebarLink>
      {context.canManage ? (
        <DropdownMenu open={menu.open} onOpenChange={menu.onOpenChange}>
          <DropdownMenuTrigger className={cn(iconButton, 'absolute right-1')} aria-label={`${list.name} options`}>
            <MoreHorizontalIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <NameDialog
              formName="list.update"
              trigger={
                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                  <PencilIcon /> Rename, icon and colour
                </DropdownMenuItem>
              }
              title="Edit list"
              submitLabel="Save"
              withIcon="optional-color"
              defaultValues={{ name: list.name, color: list.color ?? '', icon: list.icon }}
              onSubmit={(values) => mutations.update.mutateAsync({ listId: list.id, body: appearance(values) }).then(menu.done)}
            />
            <MoveMenu context={context} current={list.folderId} onMove={(target) => mutations.move.mutate({ listId: list.id, body: { folderId: target } })} />
            <DropdownMenuSeparator />
            <ConfirmDialog
              trigger={
                <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                  <TrashIcon /> Delete list
                </DropdownMenuItem>
              }
              title={`Delete ${list.name}?`}
              description="Every task in this list will be deleted."
              confirmLabel="Delete list"
              onConfirm={() =>
                mutations.remove.mutateAsync(list.id).then(
                  () => void navigate({ to: '/w/$workspaceId/p/$spaceId/$view', params: { workspaceId, spaceId: space.id, view: defaultView }, search: {} }),
                  onError,
                )
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

/** "Move to…": the space itself or any of its folders (except `exclude` and what's inside it). */
function MoveMenu({ context, current, exclude, onMove }: { context: TreeContext; current: string | null; exclude?: string; onMove: (folderId: string | null) => void }) {
  const blocked = new Set<string>();
  if (exclude) {
    const walk = (id: string) => {
      blocked.add(id);
      for (const child of context.folders.filter((folder) => folder.parentId === id)) walk(child.id);
    };
    walk(exclude);
  }
  const depthOf = (folder: FolderResponse): number => {
    const parent = context.folders.find((item) => item.id === folder.parentId);
    return parent ? depthOf(parent) + 1 : 0;
  };
  const targets = context.folders.filter((folder) => !blocked.has(folder.id));

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FolderInputIcon /> Move to
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem disabled={current === null} onSelect={() => onMove(null)}>
          <EntityIcon variant="badge" icon={context.space.icon} color={context.space.color} fallback={{ letter: context.space.name }} className="size-4" />
          {context.space.name} (top level)
        </DropdownMenuItem>
        {targets.map((folder) => (
          <DropdownMenuItem key={folder.id} disabled={current === folder.id} onSelect={() => onMove(folder.id)} style={{ paddingLeft: `${0.5 + depthOf(folder) * 0.75}rem` }}>
            <EntityIcon icon={folder.icon} color={folder.color} fallback={FolderIcon} />
            {folder.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function NewListDialog({ context, folderId, onCreated }: { context: TreeContext; folderId: string | null; onCreated: () => void }) {
  const mutations = useListMutations(context.workspaceId);
  return (
    <NameDialog
      formName="list.save"
      trigger={
        <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
          <ListPlusIcon /> List
        </DropdownMenuItem>
      }
      title="New list"
      description="Lists hold tasks."
      submitLabel="Create list"
      placeholder="e.g. Sprint backlog"
      withIcon="optional-color"
      onSubmit={(values) =>
        mutations.create
          .mutateAsync({ spaceId: context.space.id, body: { ...appearance(values), folderId } })
          .then(onCreated)
          .catch(onError)
      }
    />
  );
}

function NewFolderDialog({ context, parentId, onCreated }: { context: TreeContext; parentId: string | null; onCreated: () => void }) {
  const mutations = useFolderMutations(context.workspaceId);
  return (
    <NameDialog
      formName="folder.create"
      trigger={
        <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
          <FolderPlusIcon /> Folder
        </DropdownMenuItem>
      }
      title="New folder"
      description="Folders group lists, and can hold other folders."
      submitLabel="Create folder"
      placeholder="e.g. Q3 campaigns"
      withIcon="optional-color"
      onSubmit={(values) =>
        mutations.create
          .mutateAsync({ spaceId: context.space.id, body: { ...appearance(values), parentId } })
          .then(onCreated)
          .catch(onError)
      }
    />
  );
}

/** The space's docs, as a small tree of links into Docs. */
function SpaceDocs({ workspaceId, docs }: { workspaceId: string; docs: DocumentSummaryResponse[] }) {
  const [expanded, setExpanded] = useState(true);
  const ids = new Set(docs.map((doc) => doc.id));
  // Pages whose parent is in another space (or nowhere) start a branch here.
  const roots = docs.filter((doc) => !doc.parentId || !ids.has(doc.parentId));

  const renderDoc = (doc: DocumentSummaryResponse, depth: number): ReactNode => (
    <div key={doc.id} style={{ paddingLeft: `${depth * 0.75}rem` }}>
      <SidebarLink to="/w/$workspaceId/docs/$documentId" params={{ workspaceId, documentId: doc.id }} icon={<EntityIcon icon={doc.icon} fallback={doc.kind === 'folder' ? FolderIcon : FileTextIcon} />}>
        {doc.title}
      </SidebarLink>
      {depth < 3 ? docs.filter((child) => child.parentId === doc.id).map((child) => renderDoc(child, depth + 1)) : null}
    </div>
  );

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-1 px-1 py-0.5 text-[11px] font-semibold tracking-wide text-sidebar-muted uppercase hover:text-sidebar-foreground"
        aria-expanded={expanded}
      >
        <ChevronRightIcon className={cn('size-3 transition-transform', expanded && 'rotate-90')} /> Docs
      </button>
      {expanded ? roots.map((doc) => renderDoc(doc, 0)) : null}
    </div>
  );
}
