import type { Participant, RemoteTrack, Room } from 'livekit-client';
import { create } from 'zustand';
import { callsApi } from '../api/calls.api';

export interface CallPeer {
  identity: string;
  name: string;
  isLocal: boolean;
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  speaking: boolean;
  participant: Participant;
}

export interface JoinOptions {
  micOn: boolean;
  cameraOn: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

export interface CallTarget {
  workspaceId: string;
  channelId: string;
  /** "#design" or a person's name. */
  label: string;
}

interface CallState {
  /** The call being prepared in the lobby, if the lobby is open. */
  lobby: CallTarget | null;
  /** The call you're in (or connecting to). */
  call: CallTarget | null;
  connecting: boolean;
  peers: CallPeer[];
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  minimized: boolean;
  error: string | null;
  openLobby(workspaceId: string, channelId: string, label: string): void;
  closeLobby(): void;
  join(options: JoinOptions): Promise<void>;
  leave(): Promise<void>;
  toggleMic(): Promise<void>;
  toggleCamera(): Promise<void>;
  toggleScreen(): Promise<void>;
  setMinimized(value: boolean): void;
}

/** The one call this tab is in. Kept outside React so moving around the app keeps it going. */
let room: Room | null = null;
/** Remote audio plays through these elements; they aren't shown. */
const audio = new Map<string, HTMLMediaElement>();

function peersOf(current: Room): CallPeer[] {
  const speaking = new Set(current.activeSpeakers.map((participant) => participant.identity));
  const all: Participant[] = [current.localParticipant, ...current.remoteParticipants.values()];
  return all.map((participant) => ({
    identity: participant.identity,
    name: participant.name || 'Someone',
    isLocal: participant === current.localParticipant,
    micOn: participant.isMicrophoneEnabled,
    cameraOn: participant.isCameraEnabled,
    sharing: participant.isScreenShareEnabled,
    speaking: speaking.has(participant.identity),
    participant,
  }));
}

/**
 * Calls (D2): the lobby, the connection to LiveKit and what it shows. Tokens come from
 * the API (joinCall), which checks you can be in the channel's call.
 */
export const useCall = create<CallState>((set, get) => {
  const refresh = () => {
    if (!room) return;
    const local = room.localParticipant;
    set({ peers: peersOf(room), micOn: local.isMicrophoneEnabled, cameraOn: local.isCameraEnabled, sharing: local.isScreenShareEnabled });
  };
  const cleanUp = () => {
    for (const element of audio.values()) element.remove();
    audio.clear();
    room = null;
    set({ call: null, connecting: false, peers: [], micOn: false, cameraOn: false, sharing: false, minimized: false });
  };

  return {
    lobby: null,
    call: null,
    connecting: false,
    peers: [],
    micOn: false,
    cameraOn: false,
    sharing: false,
    minimized: false,
    error: null,

    openLobby(workspaceId, channelId, label) {
      // Already in this call: just bring it back.
      if (get().call?.channelId === channelId && room) return set({ minimized: false });
      set({ lobby: { workspaceId, channelId, label }, error: null });
    },

    closeLobby() {
      set({ lobby: null, error: null });
    },

    async join(options) {
      const target = get().lobby;
      if (!target) return;
      // One call at a time: joining another leaves this one.
      if (room) await get().leave();
      set({ call: target, connecting: true, error: null });
      try {
        // The media library loads only when someone joins a call.
        const [{ url, token }, { Room, RoomEvent, Track }] = await Promise.all([callsApi.join(target.workspaceId, target.channelId), import('livekit-client')]);
        const next = new Room({ adaptiveStream: true, dynacast: true });
        next
          .on(RoomEvent.ParticipantConnected, refresh)
          .on(RoomEvent.ParticipantDisconnected, refresh)
          .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication, participant) => {
            if (track.kind === Track.Kind.Audio) {
              const element = track.attach();
              element.hidden = true;
              document.body.append(element);
              audio.set(`${participant.identity}:${track.sid}`, element);
            }
            refresh();
          })
          .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _publication, participant) => {
            const key = `${participant.identity}:${track.sid}`;
            audio.get(key)?.remove();
            audio.delete(key);
            track.detach();
            refresh();
          })
          .on(RoomEvent.TrackMuted, refresh)
          .on(RoomEvent.TrackUnmuted, refresh)
          .on(RoomEvent.LocalTrackPublished, refresh)
          .on(RoomEvent.LocalTrackUnpublished, refresh)
          .on(RoomEvent.ActiveSpeakersChanged, refresh)
          .on(RoomEvent.Disconnected, () => {
            if (room === next) cleanUp();
          });
        room = next;
        await next.connect(url, token);
        await Promise.all([
          next.localParticipant.setMicrophoneEnabled(options.micOn, options.audioDeviceId ? { deviceId: options.audioDeviceId } : undefined).catch(() => undefined),
          next.localParticipant.setCameraEnabled(options.cameraOn, options.videoDeviceId ? { deviceId: options.videoDeviceId } : undefined).catch(() => undefined),
        ]);
        set({ lobby: null, connecting: false, minimized: false });
        refresh();
      } catch (error) {
        const current = room;
        room = null;
        await current?.disconnect().catch(() => undefined);
        set({ call: null, connecting: false, error: error instanceof Error ? error.message : 'Could not join the call' });
      }
    },

    async leave() {
      const current = room;
      if (!current) return set({ call: null, connecting: false });
      await current.disconnect();
      cleanUp();
    },

    async toggleMic() {
      if (!room) return;
      await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled).catch(() => undefined);
      refresh();
    },

    async toggleCamera() {
      if (!room) return;
      await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled).catch(() => undefined);
      refresh();
    },

    async toggleScreen() {
      if (!room) return;
      // The browser asks which screen or window; cancelling just leaves sharing off.
      await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled).catch(() => undefined);
      refresh();
    },

    setMinimized(value) {
      set({ minimized: value });
    },
  };
});
