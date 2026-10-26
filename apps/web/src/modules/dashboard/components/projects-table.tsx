import { Link } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { useState } from 'react';
import type { DashboardResponse } from '@taskflow/shared-types';
import { Meter } from '@/components/kit/charts';
import { Checkbox } from '@/components/ui/checkbox';
import { formatNumericDate } from '@/lib/periods';
import { formatMinutes } from '@/modules/time';
import { SpaceStatusChip } from './space-status-chip';

/** Every project's health in one table: progress, open, overdue, due soon, hours and team size. */
export function ProjectsTable({ workspaceId, projects }: { workspaceId: string; projects: DashboardResponse['projects'] }) {
  const [hideEmpty, setHideEmpty] = useState(true);
  const [filter, setFilter] = useState('');
  const rows = projects.filter((project) => (!hideEmpty || project.open + project.closed > 0) && project.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <section className="rounded-xl border bg-card" aria-label="Projects">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <h2 className="flex-1 text-base font-semibold">Projects</h2>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={hideEmpty} onCheckedChange={(checked) => setHideEmpty(checked === true)} /> Hide empty
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter projects" aria-label="Filter projects" className="h-8 w-48 rounded-md border bg-muted/40 pr-2 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Progress</th>
              <th className="px-2 py-2 text-right font-medium">Open</th>
              <th className="px-2 py-2 text-right font-medium">Overdue</th>
              <th className="px-2 py-2 text-right font-medium">Due 7d</th>
              <th className="px-2 py-2 text-right font-medium">Hours</th>
              <th className="px-4 py-2 text-right font-medium">Team</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((project) => (
              <tr key={project.spaceId} className="border-b last:border-b-0 hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <Link to="/w/$workspaceId/p/$spaceId/$view" params={{ workspaceId, spaceId: project.spaceId, view: 'dashboard' }} className="font-semibold hover:text-primary">
                    {project.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">updated {project.updatedAt ? formatNumericDate(project.updatedAt) : '–'}</div>
                </td>
                <td className="px-2">
                  <SpaceStatusChip status={project.status} />
                </td>
                <td className="px-2">
                  <span className="flex items-center gap-3">
                    <Meter value={project.progress} label={`${project.name} progress`} className="w-28" />
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{project.progress}%</span>
                  </span>
                </td>
                <td className="px-2 text-right tabular-nums">{project.open}</td>
                <td className={project.overdue ? 'px-2 text-right text-critical tabular-nums' : 'px-2 text-right text-muted-foreground tabular-nums'}>{project.overdue}</td>
                <td className={project.dueSoon ? 'px-2 text-right text-warning tabular-nums' : 'px-2 text-right text-muted-foreground tabular-nums'}>{project.dueSoon}</td>
                <td className="px-2 text-right tabular-nums">{project.minutes ? formatMinutes(project.minutes) : '–'}</td>
                <td className="px-4 text-right tabular-nums">{project.assignees || '–'}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No projects match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
