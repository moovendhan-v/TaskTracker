import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  isWalkable,
  OFFICE_CHOSEN_STATUSES,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  OFFICE_ZONES,
  type OfficeChosenStatus,
  type OfficeStatus,
  type OfficeZoneKind,
} from '@taskflow/shared-types';
import { ArmchairIcon, HeadphonesIcon, MessagesSquareIcon } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { useCall } from '@/modules/chat';
import { officeApi } from '../api/office.api';

/** One tile, in pixels. */
const TILE = 36;
type View = 'flat' | 'isometric';
type Person = Awaited<ReturnType<typeof officeApi.get>>[number];

const STATUS_LABEL: Record<OfficeStatus, string> = { available: 'Available', focused: 'Focused', in_meeting: 'In a meeting', away: 'Away', offline: 'Offline' };
const STATUS_DOT: Record<OfficeStatus, string> = {
  available: 'bg-good',
  focused: 'bg-violet-500',
  in_meeting: 'bg-red-500',
  away: 'bg-amber-500',
  offline: 'bg-muted-foreground/50',
};
const ZONE_STYLE: Record<OfficeZoneKind, string> = {
  desks: 'bg-sky-500/10 border-sky-500/30',
  focus: 'bg-violet-500/10 border-violet-500/30',
  lounge: 'bg-amber-500/10 border-amber-500/30',
  meeting: 'bg-emerald-500/10 border-emerald-500/40',
};

/**
 * The virtual office (D3): the workspace's floor, who's where and how they show. Click a spot
 * (or use the arrow keys) to walk; a meeting room offers its huddle. Flat or isometric.
 */
export function OfficePage({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const key = [...queryKeys.workspace(workspaceId), 'office'] as const;
  const office = useQuery({ queryKey: key, queryFn: () => officeApi.get(workspaceId), refetchInterval: 60_000 });
  const { data: me } = useCurrentUser();
  const [view, setView] = useState<View>('flat');
  const openLobby = useCall((state) => state.openLobby);
  const people = office.data ?? [];
  const mine = people.find((person) => person.userId === me?.id);

  // Here while the page is open: a sign of life every minute, and offline as soon as you leave.
  useEffect(() => {
    const beat = () =>
      void officeApi
        .heartbeat(workspaceId)
        .then(() => queryClient.invalidateQueries({ queryKey: [...queryKeys.workspace(workspaceId), 'office'] }))
        .catch(() => undefined);
    beat();
    const timer = setInterval(beat, 60_000);
    return () => {
      clearInterval(timer);
      void officeApi.leave(workspaceId).catch(() => undefined);
    };
  }, [workspaceId, queryClient]);

  const move = useMutation({
    mutationFn: ({ x, y }: { x: number; y: number }) => officeApi.move(workspaceId, x, y),
    onMutate: ({ x, y }) => {
      // Walk at once; the server has the last word.
      const before = queryClient.getQueryData<Person[]>(key);
      queryClient.setQueryData<Person[]>(key, (list) => list?.map((person) => (person.userId === me?.id ? { ...person, x, y } : person)));
      return { before };
    },
    onError: (error, _vars, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before);
      notify.error(error);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
  const setStatus = useMutation({
    mutationFn: (status: OfficeChosenStatus) => officeApi.setStatus(workspaceId, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => notify.error(error),
  });
  const room = useMutation({
    mutationFn: ({ zoneId }: { zoneId: string; then: 'huddle' | 'chat'; name: string }) => officeApi.meetingRoom(workspaceId, zoneId),
    onSuccess: (channelId, { then, name }) => {
      if (then === 'huddle') openLobby(workspaceId, channelId, name);
      else void navigate({ to: '/w/$workspaceId/chat/$channelId', params: { workspaceId, channelId } });
    },
    onError: (error) => notify.error(error),
  });

  const occupied = new Set(people.filter((person) => person.status !== 'offline' && person.userId !== me?.id).map((person) => `${person.x},${person.y}`));
  const walk = (x: number, y: number) => {
    if (!mine || !isWalkable(x, y) || occupied.has(`${x},${y}`) || (mine.x === x && mine.y === y)) return;
    move.mutate({ x, y });
  };
  const onKey = (event: KeyboardEvent) => {
    if (!mine) return;
    const step: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const delta = step[event.key];
    if (!delta) return;
    event.preventDefault();
    walk(mine.x + delta[0], mine.y + delta[1]);
  };
  const myZone = OFFICE_ZONES.find((zone) => zone.id === mine?.zoneId);
  const here = people.filter((person) => person.status !== 'offline');

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Office"
        description={`${here.length} here now`}
        icon={<ArmchairIcon className="size-5 text-muted-foreground" />}
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Your status
              <select
                aria-label="Your status"
                value={mine?.chosenStatus ?? 'available'}
                onChange={(event) => setStatus.mutate(event.target.value as OfficeChosenStatus)}
                className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {OFFICE_CHOSEN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
            <div role="group" aria-label="Floor view" className="flex rounded-md border p-0.5">
              {(['flat', 'isometric'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={cn('h-7 rounded px-2 text-xs capitalize transition-colors', view === option ? 'bg-primary-soft font-medium text-ring' : 'text-muted-foreground hover:bg-muted')}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="grid gap-3">
          {myZone?.kind === 'meeting' ? (
            <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm animate-in fade-in-0 slide-in-from-top-1">
              <span className="flex-1">
                You’re in <span className="font-medium">{myZone.name}</span>.
              </span>
              <Button size="sm" disabled={room.isPending} onClick={() => room.mutate({ zoneId: myZone.id, then: 'huddle', name: myZone.name })}>
                <HeadphonesIcon /> Join the huddle
              </Button>
              <Button size="sm" variant="outline" disabled={room.isPending} onClick={() => room.mutate({ zoneId: myZone.id, then: 'chat', name: myZone.name })}>
                <MessagesSquareIcon /> Room chat
              </Button>
            </div>
          ) : null}
          <div className="overflow-auto rounded-2xl border bg-card p-4">
            <div className={cn('mx-auto w-max transition-transform duration-500', view === 'isometric' && '-my-16')} style={{ perspective: 1200 }}>
              <div
                role="application"
                aria-label="Office floor. Click a spot, or use the arrow keys, to walk there."
                tabIndex={0}
                onKeyDown={onKey}
                className="relative rounded-xl bg-muted/40 outline-none transition-transform duration-500 focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  width: OFFICE_WIDTH * TILE,
                  height: OFFICE_HEIGHT * TILE,
                  transform: view === 'isometric' ? 'rotateX(55deg) rotateZ(-45deg) scale(0.8)' : 'none',
                  transformStyle: 'preserve-3d',
                  backgroundImage: 'linear-gradient(to right, color-mix(in oklab, var(--border) 60%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 60%, transparent) 1px, transparent 1px)',
                  backgroundSize: `${TILE}px ${TILE}px`,
                }}
                onClick={(event) => {
                  // In the isometric view the floor is rotated; the tile under the pointer comes from the event's target.
                  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-tile]');
                  if (target) walk(Number(target.dataset['x']), Number(target.dataset['y']));
                }}
              >
                {/* Walls */}
                <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl border-[6px] border-border" />
                {OFFICE_ZONES.map((zone) => (
                  <div
                    key={zone.id}
                    className={cn('pointer-events-none absolute rounded-lg border-2 border-dashed', ZONE_STYLE[zone.kind])}
                    style={{ left: zone.x * TILE, top: zone.y * TILE, width: zone.w * TILE, height: zone.h * TILE }}
                  >
                    <span className="absolute top-1 left-2 text-[11px] font-medium text-muted-foreground">{zone.name}</span>
                  </div>
                ))}
                {/* Click targets, one per walkable tile. */}
                {Array.from({ length: OFFICE_HEIGHT }, (_, y) =>
                  Array.from({ length: OFFICE_WIDTH }, (_, x) =>
                    isWalkable(x, y) ? <div key={`${x},${y}`} data-tile data-x={x} data-y={y} className="absolute cursor-pointer hover:bg-primary/10" style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE }} /> : null,
                  ),
                )}
                {people.map((person) => (
                  <div
                    key={person.userId}
                    aria-label={`${person.name}${person.userId === me?.id ? ' (you)' : ''}: ${STATUS_LABEL[person.status]}`}
                    role="img"
                    className={cn('pointer-events-none absolute flex flex-col items-center transition-[left,top,opacity] duration-500 ease-[cubic-bezier(0.22,1.3,0.36,1)]', person.status === 'offline' && 'opacity-40')}
                    style={{ left: person.x * TILE, top: person.y * TILE, width: TILE, height: TILE, transformStyle: 'preserve-3d' }}
                  >
                    <div
                      className="relative transition-transform duration-500"
                      style={{ transform: view === 'isometric' ? 'rotateZ(45deg) rotateX(-55deg) translateY(-14px)' : 'none', transformOrigin: 'bottom center' }}
                    >
                      <UserAvatar name={person.name} className={cn('size-8 text-[10px] ring-2 ring-background', person.userId === me?.id && 'ring-primary')} />
                      <span aria-hidden className={cn('absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-background', STATUS_DOT[person.status])} />
                      <span className="absolute top-full left-1/2 mt-0.5 -translate-x-1/2 rounded bg-background/90 px-1 text-[10px] whitespace-nowrap shadow-sm">{person.name.split(' ')[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <aside aria-label="People" className="grid content-start gap-3">
          {(['available', 'focused', 'in_meeting', 'away', 'offline'] as const).map((status) => {
            const group = people.filter((person) => person.status === status);
            if (!group.length) return null;
            return (
              <section key={status} aria-label={STATUS_LABEL[status]}>
                <h3 className="mb-1 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
                  <span aria-hidden className={cn('size-2 rounded-full', STATUS_DOT[status])} />
                  {STATUS_LABEL[status]} · {group.length}
                </h3>
                <ul className="grid gap-1">
                  {group.map((person) => (
                    <li key={person.userId} className="flex items-center gap-2 text-sm">
                      <UserAvatar name={person.name} className="size-6 text-[9px]" />
                      <span className="min-w-0 flex-1 truncate">{person.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{OFFICE_ZONES.find((zone) => zone.id === person.zoneId)?.name ?? ''}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
