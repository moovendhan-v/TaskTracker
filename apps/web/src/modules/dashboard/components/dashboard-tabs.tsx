import { DASHBOARD_LIMITS, type NamedDashboardResponse } from '@taskflow/shared-types';
import { CopyIcon, GlobeIcon, LayoutGridIcon, ListTodoIcon, LockIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

export type HomeTab = 'overview' | 'mine' | `dashboard:${string}`;

function NameDialog({ open, onOpenChange, title, description, initial, submitLabel, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit(name.trim());
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Input autoFocus value={name} maxLength={DASHBOARD_LIMITS.nameMax} onChange={(event) => setName(event.target.value)} aria-label="Dashboard name" placeholder="e.g. Sprint health" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const tabClass = (active: boolean) =>
  cn(
    'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5',
    active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
  );

interface DashboardTabsProps {
  tab: HomeTab;
  onTab: (tab: HomeTab) => void;
  dashboards: readonly NamedDashboardResponse[];
  ownerName: (userId: string) => string;
  onCreate: (name: string) => Promise<NamedDashboardResponse>;
  onRename: (dashboard: NamedDashboardResponse, name: string) => Promise<unknown>;
  onShare: (dashboard: NamedDashboardResponse, shared: boolean) => void;
  onDuplicate: (dashboard: NamedDashboardResponse) => void;
  onDelete: (dashboard: NamedDashboardResponse) => Promise<unknown>;
  aside?: ReactNode;
}

/** Overview, My work and the named dashboards (v2 Features #13b), each marked Private or Workspace. */
export function DashboardTabs({ tab, onTab, dashboards, ownerName, onCreate, onRename, onShare, onDuplicate, onDelete, aside }: DashboardTabsProps) {
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<NamedDashboardResponse | null>(null);
  const active = dashboards.find((dashboard) => `dashboard:${dashboard.id}` === tab);
  const ownedCount = dashboards.filter((dashboard) => dashboard.mine).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Dashboards" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5 [scrollbar-width:none]">
        <button type="button" aria-current={tab === 'overview' ? 'page' : undefined} className={tabClass(tab === 'overview')} onClick={() => onTab('overview')}>
          <LayoutGridIcon /> Overview
        </button>
        <button type="button" aria-current={tab === 'mine' ? 'page' : undefined} className={tabClass(tab === 'mine')} onClick={() => onTab('mine')}>
          <ListTodoIcon /> My work
        </button>
        {dashboards.length ? <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border-strong" /> : null}
        {dashboards.map((dashboard) => {
          const selected = `dashboard:${dashboard.id}` === tab;
          const shared = dashboard.visibility === 'workspace';
          return (
            <button
              key={dashboard.id}
              type="button"
              aria-current={selected ? 'page' : undefined}
              title={shared ? (dashboard.mine ? 'Shared with the workspace' : `Shared by ${ownerName(dashboard.ownerId)}`) : 'Private: only you can see it'}
              className={tabClass(selected)}
              onClick={() => onTab(`dashboard:${dashboard.id}`)}
            >
              {shared ? <UsersIcon aria-label="Workspace" /> : <LockIcon aria-label="Private" />}
              {dashboard.name}
              {!dashboard.mine ? <span className="text-[11px] font-normal text-subtle-foreground">· {ownerName(dashboard.ownerId).split(' ')[0]}</span> : null}
            </button>
          );
        })}
        <button
          type="button"
          className={cn(tabClass(false), 'text-subtle-foreground')}
          disabled={ownedCount >= DASHBOARD_LIMITS.perOwner}
          title={ownedCount >= DASHBOARD_LIMITS.perOwner ? `You have the maximum of ${DASHBOARD_LIMITS.perOwner} dashboards` : 'New dashboard'}
          onClick={() => setCreating(true)}
        >
          <PlusIcon /> New dashboard
        </button>
      </nav>
      {active ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`${active.name} options`}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {active.mine ? (
              <>
                <DropdownMenuItem onSelect={() => setRenaming(active)}>
                  <PencilIcon /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onShare(active, active.visibility !== 'workspace')}>
                  {active.visibility === 'workspace' ? <LockIcon /> : <GlobeIcon />}
                  {active.visibility === 'workspace' ? 'Make private' : 'Share with workspace'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onDuplicate(active)}>
                  <CopyIcon /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                      <Trash2Icon /> Delete
                    </DropdownMenuItem>
                  }
                  title={`Delete “${active.name}”?`}
                  description={active.visibility === 'workspace' ? 'It disappears for everyone in the workspace.' : 'Only the dashboard goes; your data stays.'}
                  confirmLabel="Delete dashboard"
                  onConfirm={() => onDelete(active)}
                />
              </>
            ) : (
              <DropdownMenuItem onSelect={() => onDuplicate(active)}>
                <CopyIcon /> Duplicate to my dashboards
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {aside}
      {creating ? (
        <NameDialog
          open
          onOpenChange={setCreating}
          title="New dashboard"
          description="It starts private with the default blocks. Arrange it, then share it with the workspace if you like."
          initial=""
          submitLabel="Create"
          onSubmit={async (name) => onTab(`dashboard:${(await onCreate(name)).id}`)}
        />
      ) : null}
      {renaming ? (
        <NameDialog
          open
          onOpenChange={(open) => !open && setRenaming(null)}
          title="Rename dashboard"
          description="Everyone it's shared with sees the new name."
          initial={renaming.name}
          submitLabel="Save"
          onSubmit={(name) => onRename(renaming, name)}
        />
      ) : null}
    </div>
  );
}
