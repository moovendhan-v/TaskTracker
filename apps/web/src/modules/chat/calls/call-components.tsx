import { createLocalVideoTrack, Room, Track, type LocalVideoTrack, type Participant, type VideoTrack } from 'livekit-client';
import {
  HeadphonesIcon,
  Maximize2Icon,
  MicIcon,
  MicOffIcon,
  Minimize2Icon,
  MonitorUpIcon,
  PhoneOffIcon,
  PictureInPicture2Icon,
  VideoIcon,
  VideoOffIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { useCall, type CallPeer } from './call-store';

/** The camera (or screen share) track of a participant, to attach to a <video>. */
function videoTrackOf(participant: Participant, prefer: 'screen' | 'camera' = 'camera') {
  const screen = participant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack;
  const camera = participant.getTrackPublication(Track.Source.Camera)?.videoTrack;
  return prefer === 'screen' ? (screen ?? camera) : (camera ?? screen);
}

const SELECT = 'h-8 w-full rounded-md border bg-background px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Shows a video track; detaches it when the tile goes. */
function TrackVideo({ track, mirror, className, videoRef }: { track: VideoTrack; mirror?: boolean; className?: string; videoRef?: (element: HTMLVideoElement | null) => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  return (
    <video
      ref={(element) => {
        ref.current = element;
        videoRef?.(element);
      }}
      autoPlay
      playsInline
      muted
      className={cn('size-full object-cover', mirror && '-scale-x-100', className)}
    />
  );
}

/** One person in the call: their video, or their avatar; muted and speaking states. */
function PeerTile({ peer, onVideo }: { peer: CallPeer; onVideo?: (element: HTMLVideoElement | null) => void }) {
  const track = peer.cameraOn || peer.sharing ? videoTrackOf(peer.participant, peer.sharing ? 'screen' : 'camera') : undefined;
  return (
    <li
      aria-label={`${peer.name}${peer.isLocal ? ' (you)' : ''}${peer.micOn ? '' : ', muted'}`}
      className={cn(
        'relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-muted ring-2 ring-transparent transition-shadow duration-200',
        peer.speaking && 'ring-good shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-good)_25%,transparent)]',
      )}
    >
      {track ? <TrackVideo track={track} mirror={peer.isLocal && !peer.sharing} videoRef={onVideo} /> : <UserAvatar name={peer.name} className="size-12 text-base" />}
      <span className="absolute bottom-1.5 left-1.5 flex max-w-[85%] items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] text-white">
        {peer.micOn ? <MicIcon aria-hidden className="size-3" /> : <MicOffIcon aria-hidden className="size-3 text-red-300" />}
        <span className="truncate">
          {peer.name}
          {peer.isLocal ? ' (you)' : ''}
        </span>
      </span>
    </li>
  );
}

/**
 * The lobby before joining a call (D2): camera preview, microphone and camera on or off,
 * and which devices to use. Nothing is sent until you press Join.
 */
export function CallLobby() {
  const lobby = useCall((state) => state.lobby);
  const connecting = useCall((state) => state.connecting);
  const error = useCall((state) => state.error);
  const join = useCall((state) => state.join);
  const close = useCall((state) => state.closeLobby);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [devices, setDevices] = useState<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }>({ audio: [], video: [] });
  const [audioDeviceId, setAudioDeviceId] = useState<string | undefined>();
  const [videoDeviceId, setVideoDeviceId] = useState<string | undefined>();
  const [preview, setPreview] = useState<LocalVideoTrack | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const open = lobby !== null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([Room.getLocalDevices('audioinput', false), Room.getLocalDevices('videoinput', false)])
      .then(([audio, video]) => !cancelled && setDevices({ audio, video }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  // The camera preview runs only while the camera is on in the lobby.
  useEffect(() => {
    if (!open || !cameraOn) return;
    let track: LocalVideoTrack | null = null;
    let cancelled = false;
    createLocalVideoTrack(videoDeviceId ? { deviceId: videoDeviceId } : undefined)
      .then((created) => {
        if (cancelled) return created.stop();
        track = created;
        setPreview(created);
        setPreviewError(null);
      })
      .catch(() => {
        if (!cancelled) setPreviewError('Your camera isn’t available. You can still join with sound.');
      });
    return () => {
      cancelled = true;
      track?.stop();
      setPreview(null);
    };
  }, [open, cameraOn, videoDeviceId]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeadphonesIcon className="size-4 text-muted-foreground" /> Huddle in {lobby?.label}
          </DialogTitle>
          <DialogDescription>Check how you look and sound. Everyone who can read the conversation can join.</DialogDescription>
        </DialogHeader>
        <div className="grid aspect-video place-items-center overflow-hidden rounded-xl bg-muted">
          {cameraOn && preview ? (
            <TrackVideo track={preview} mirror />
          ) : (
            <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <VideoOffIcon className="size-6" />
              {previewError ?? 'Camera off'}
            </span>
          )}
        </div>
        <div className="flex justify-center gap-2">
          <Button type="button" variant={micOn ? 'outline' : 'destructive'} size="sm" aria-pressed={micOn} onClick={() => setMicOn((value) => !value)}>
            {micOn ? <MicIcon /> : <MicOffIcon />} {micOn ? 'Mic on' : 'Mic off'}
          </Button>
          <Button type="button" variant="outline" size="sm" aria-pressed={cameraOn} onClick={() => setCameraOn((value) => !value)}>
            {cameraOn ? <VideoIcon /> : <VideoOffIcon />} {cameraOn ? 'Camera on' : 'Camera off'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="call-microphone" className="text-xs">
              Microphone
            </Label>
            <select id="call-microphone" className={SELECT} value={audioDeviceId ?? ''} onChange={(event) => setAudioDeviceId(event.target.value || undefined)}>
              <option value="">Default</option>
              {devices.audio.filter((device) => device.deviceId).map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="call-camera" className="text-xs">
              Camera
            </Label>
            <select id="call-camera" className={SELECT} value={videoDeviceId ?? ''} onChange={(event) => setVideoDeviceId(event.target.value || undefined)}>
              <option value="">Default</option>
              {devices.video.filter((device) => device.deviceId).map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="button" disabled={connecting} onClick={() => void join({ micOn, cameraOn, audioDeviceId, videoDeviceId })}>
            <HeadphonesIcon /> {connecting ? 'Joining…' : 'Join'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The call you're in (D2), docked over the app so it keeps going as you move around:
 * everyone's tiles, mute, camera, screen share, picture-in-picture and leave. Folds into a
 * small bar.
 */
export function CallDock() {
  const call = useCall((state) => state.call);
  const peers = useCall((state) => state.peers);
  const connecting = useCall((state) => state.connecting);
  const micOn = useCall((state) => state.micOn);
  const cameraOn = useCall((state) => state.cameraOn);
  const sharing = useCall((state) => state.sharing);
  const minimized = useCall((state) => state.minimized);
  const { toggleMic, toggleCamera, toggleScreen, leave, setMinimized } = useCall.getState();
  const videos = useRef(new Map<string, HTMLVideoElement>());
  if (!call || (connecting && peers.length === 0)) return null;

  const pictureInPicture = () => {
    // The person speaking (or sharing), else anyone with video.
    const order = [...peers].sort((a, b) => Number(b.sharing) - Number(a.sharing) || Number(b.speaking) - Number(a.speaking) || Number(a.isLocal) - Number(b.isLocal));
    const element = order.map((peer) => videos.current.get(peer.identity)).find((video) => video && video.readyState > 0);
    if (element && 'requestPictureInPicture' in element) void element.requestPictureInPicture().catch(() => undefined);
  };
  const anyVideo = peers.some((peer) => peer.cameraOn || peer.sharing);

  return (
    <section
      aria-label={`Huddle in ${call.label}`}
      className={cn(
        'fixed right-4 bottom-4 z-50 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in-0 slide-in-from-bottom-3 max-sm:right-2 max-sm:bottom-20 max-sm:left-2',
        minimized ? 'w-72' : 'w-[min(560px,calc(100vw-2rem))]',
      )}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-good" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">Huddle · {call.label}</span>
        <span className="text-xs text-muted-foreground">{peers.length} in call</span>
        <Button size="icon-sm" variant="ghost" aria-label={minimized ? 'Show the call' : 'Fold the call'} onClick={() => setMinimized(!minimized)}>
          {minimized ? <Maximize2Icon /> : <Minimize2Icon />}
        </Button>
      </header>
      {minimized ? (
        <ul aria-label="In the call" className="flex -space-x-1.5 px-3 pt-2">
          {peers.slice(0, 8).map((peer) => (
            <li key={peer.identity} title={peer.name} className={cn('rounded-full ring-2 ring-card', peer.speaking && 'ring-good')}>
              <UserAvatar name={peer.name} className="size-7 text-[10px]" />
            </li>
          ))}
        </ul>
      ) : (
        <ul aria-label="In the call" className={cn('grid max-h-[60vh] gap-2 overflow-y-auto p-2', peers.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {peers.map((peer) => (
            <PeerTile
              key={peer.identity}
              peer={peer}
              onVideo={(element) => {
                if (element) videos.current.set(peer.identity, element);
                else videos.current.delete(peer.identity);
              }}
            />
          ))}
        </ul>
      )}
      <div className="flex items-center justify-center gap-1.5 p-2">
        <Button size="icon" variant={micOn ? 'outline' : 'destructive'} aria-label={micOn ? 'Mute' : 'Unmute'} aria-pressed={!micOn} onClick={() => void toggleMic()}>
          {micOn ? <MicIcon /> : <MicOffIcon />}
        </Button>
        <Button size="icon" variant="outline" aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'} aria-pressed={cameraOn} onClick={() => void toggleCamera()}>
          {cameraOn ? <VideoIcon /> : <VideoOffIcon />}
        </Button>
        <Button size="icon" variant={sharing ? 'default' : 'outline'} aria-label={sharing ? 'Stop sharing' : 'Share your screen'} aria-pressed={sharing} onClick={() => void toggleScreen()}>
          <MonitorUpIcon />
        </Button>
        {anyVideo && !minimized ? (
          <Button size="icon" variant="outline" aria-label="Picture in picture" onClick={pictureInPicture}>
            <PictureInPicture2Icon />
          </Button>
        ) : null}
        <Button variant="destructive" onClick={() => void leave()}>
          <PhoneOffIcon /> Leave
        </Button>
      </div>
    </section>
  );
}
