import { useQuery } from '@tanstack/react-query';
import { HeadphonesIcon } from 'lucide-react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/query-keys';
import { callsApi } from '../api/calls.api';
import { useCall } from './call-store';

/** Calls going on now (refreshed by chat's live events), and whether calls are set up at all. */
export function useCallsOverview(workspaceId: string) {
  return useQuery({ queryKey: [...queryKeys.chatRoot(workspaceId), 'calls'], queryFn: () => callsApi.overview(workspaceId), staleTime: 15_000 });
}

/** The channel header's Huddle button: start one, or join the one going on (with who's in it). */
export function HuddleButton({ workspaceId, channelId, label, disabled }: { workspaceId: string; channelId: string; label: string; disabled?: boolean }) {
  const overview = useCallsOverview(workspaceId);
  const openLobby = useCall((state) => state.openLobby);
  const inThisCall = useCall((state) => state.call?.channelId === channelId);
  if (!overview.data?.enabled) return null;
  const call = overview.data.calls.find((item) => item.channelId === channelId);
  const people = call?.participants ?? [];
  return (
    <Button
      size="sm"
      variant={call ? 'default' : 'outline'}
      disabled={disabled}
      onClick={() => openLobby(workspaceId, channelId, label)}
      aria-label={inThisCall ? 'Show the huddle' : call ? `Join the huddle (${people.length} in it)` : 'Start a huddle'}
      className="gap-1.5"
    >
      {people.length ? (
        <span aria-hidden className="flex -space-x-1">
          {people.slice(0, 3).map((person) => (
            <UserAvatar key={person.userId} name={person.name} className="size-4 text-[7px] ring-1 ring-background" />
          ))}
        </span>
      ) : (
        <HeadphonesIcon />
      )}
      {inThisCall ? 'In huddle' : call ? 'Join huddle' : 'Huddle'}
    </Button>
  );
}
