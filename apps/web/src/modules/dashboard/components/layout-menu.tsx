import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanLayoutItem, validateLayoutItems, type LayoutItem, type LayoutPage } from '@taskflow/shared-types';
import { BuildingIcon, ChevronDownIcon, DownloadIcon, HistoryIcon, Undo2Icon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { downloadTflow, readTflow, TFLOW_ACCEPT } from '@/lib/tflow';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { queryKeys } from '@/lib/query-keys';
import { timeAgo } from '@/lib/relative-time';
import { usePermissions } from '@/modules/workspaces';
import { layoutsApi } from '../api/layouts.api';
import type { ArrangeableLayout } from '../hooks/use-layout';

const PAGE_NAMES: Record<LayoutPage, string> = { home: 'Home', project: 'Project dashboard' };

/** A layout without the workspace-specific bits (a block's own project), so it fits anywhere. */
function portableItems(items: readonly LayoutItem[]): LayoutItem[] {
  return items.map((item) => {
    if (!item.config?.spaceId) return item;
    const { spaceId: _drop, ...config } = item.config;
    return { ...item, config: Object.keys(config).length ? config : null };
  });
}

/**
 * The layout menu for a personal page layout (Features #11c): go back to an earlier save,
 * and, with layout.manage, make this arrangement everyone's starting point.
 */
export function LayoutMenu({ workspaceId, layout }: { workspaceId: string; layout: ArrangeableLayout }) {
  const { can } = usePermissions(workspaceId);
  const queryClient = useQueryClient();
  const [history, setHistory] = useState(false);
  const pageKey = layout.pageKey as LayoutPage;
  const manage = can('layout.manage');
  const workspace = useQuery({ queryKey: ['workspaces', workspaceId, 'layouts', 'workspace-default', pageKey], queryFn: () => layoutsApi.workspaceDefault(workspaceId, pageKey), enabled: manage });

  const publish = async () => {
    if (!layout.items) return;
    try {
      await layoutsApi.setWorkspaceDefault(workspaceId, pageKey, layout.items);
      notify.success('This is now the workspace default');
      void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'layouts'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.layout(workspaceId, pageKey) });
    } catch (error) {
      notify.error(error);
    }
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const exportLayout = () => {
    if (!layout.items) return;
    downloadTflow('dashboard-layout', `${PAGE_NAMES[pageKey]} layout`, { pageKey, items: portableItems(layout.items) });
  };
  const importLayout = async (file: File) => {
    try {
      const { payload } = await readTflow(file, 'dashboard-layout');
      const data = payload as { pageKey?: unknown; items?: unknown };
      if (data.pageKey !== pageKey) throw new Error(`That layout is for ${typeof data.pageKey === 'string' && data.pageKey in PAGE_NAMES ? `the ${PAGE_NAMES[data.pageKey as LayoutPage]} page` : 'another page'}`);
      if (!Array.isArray(data.items)) throw new Error('That layout has no blocks');
      const items = portableItems((data.items as LayoutItem[]).map(cleanLayoutItem));
      // The same rules the server applies; it checks them again when the layout saves.
      const problems = validateLayoutItems(pageKey, items);
      if (problems.length) throw new Error(`That layout doesn’t fit this page: ${problems[0]}`);
      layout.setItems(items);
      notify.success('Layout imported. Undo puts the old one back.');
    } catch (error) {
      notify.error(error);
    }
  };
  const clear = async () => {
    try {
      await layoutsApi.clearWorkspaceDefault(workspaceId, pageKey);
      notify.success('Removed the workspace default');
      void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'layouts'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.layout(workspaceId, pageKey) });
    } catch (error) {
      notify.error(error);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Layout <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => setHistory(true)}>
            <HistoryIcon /> Version history…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportLayout} disabled={!layout.items}>
            <DownloadIcon /> Export as .tflow
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            <UploadIcon /> Import a layout…
          </DropdownMenuItem>
          {manage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void publish()} disabled={!layout.items}>
                <BuildingIcon /> Make this the workspace default
              </DropdownMenuItem>
              {workspace.data ? (
                <DropdownMenuItem onSelect={() => void clear()}>
                  <Undo2Icon /> Remove the workspace default
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInput}
        type="file"
        accept={TFLOW_ACCEPT}
        className="hidden"
        aria-label="Layout file to import"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importLayout(file);
        }}
      />
      {history ? <VersionHistory workspaceId={workspaceId} layout={layout} pageKey={pageKey} onClose={() => setHistory(false)} /> : null}
    </>
  );
}

function VersionHistory({ workspaceId, layout, pageKey, onClose }: { workspaceId: string; layout: ArrangeableLayout; pageKey: LayoutPage; onClose: () => void }) {
  const versions = useQuery({ queryKey: ['workspaces', workspaceId, 'layouts', 'versions', pageKey], queryFn: () => layoutsApi.versions(workspaceId, pageKey), staleTime: 0 });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>Your last 20 saves of this page. Restoring one saves it as a new version, so you can undo it.</DialogDescription>
        </DialogHeader>
        <ul aria-label="Versions" className="max-h-80 divide-y overflow-y-auto rounded-lg border">
          {(versions.data ?? []).map((version, index) => (
            <li key={`${version.version}-${version.savedAt}`} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  Version {version.version} {index === 0 ? <span className="font-normal text-muted-foreground">· current</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(version.savedAt)} · {version.items.length} {version.items.length === 1 ? 'block' : 'blocks'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={index === 0}
                onClick={() => {
                  layout.setItems(version.items);
                  onClose();
                  notify.success(`Restored version ${version.version}`);
                }}
              >
                Restore
              </Button>
            </li>
          ))}
          {versions.data?.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">No saves yet. Arrange the page to start a history.</li> : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
