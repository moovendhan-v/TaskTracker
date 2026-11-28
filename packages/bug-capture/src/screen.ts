/**
 * Screenshots and screen recordings through the browser's own screen-sharing prompt
 * (getDisplayMedia), so nothing is captured without the reporter choosing what to share, and no
 * third-party service is involved.
 */

export const RECORDING_LIMITS = {
  /** Long enough to show a bug, short enough to stay under the 10 MB attachment limit. */
  maxSeconds: 60,
  videoBitsPerSecond: 1_000_000,
  audioBitsPerSecond: 64_000,
} as const;

export function canCaptureScreen(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

function displayStream(audio: boolean): Promise<MediaStream> {
  // preferCurrentTab / selfBrowserSurface are Chrome hints; other browsers ignore them.
  const options = { video: { displaySurface: 'browser', frameRate: 30 }, audio, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' } as DisplayMediaStreamOptions;
  return navigator.mediaDevices.getDisplayMedia(options);
}

/** One frame of the shared screen, as a PNG. */
export async function captureScreenshot(): Promise<Blob> {
  const stream = await displayStream(false);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // Let the browser's sharing banner settle so the frame is the page, not the prompt.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    video.srcObject = null;
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not read the screenshot'))), 'image/png'));
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

export interface Recording {
  /** Stops and returns the video (WebM or MP4, whichever the browser records). */
  stop(): Promise<Blob>;
  /** Stops and throws the video away. */
  cancel(): void;
  /** Resolves when the recording ended by itself: time limit, or sharing stopped from the browser bar. */
  readonly ended: Promise<Blob>;
  readonly mimeType: string;
}

function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

/** Records the shared screen, with the microphone when asked (and allowed). */
export async function startRecording(options: { microphone?: boolean; maxSeconds?: number; onTick?: (seconds: number) => void } = {}): Promise<Recording> {
  const display = await displayStream(false);
  let mic: MediaStream | null = null;
  if (options.microphone) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      // No microphone or permission refused: record without sound.
      mic = null;
    }
  }
  const stream = new MediaStream([...display.getVideoTracks(), ...(mic?.getAudioTracks() ?? [])]);
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined, videoBitsPerSecond: RECORDING_LIMITS.videoBitsPerSecond, audioBitsPerSecond: RECORDING_LIMITS.audioBitsPerSecond });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopTracks = () => {
    for (const track of [...display.getTracks(), ...(mic?.getTracks() ?? [])]) track.stop();
  };
  let cancelled = false;
  const ended = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      stopTracks();
      window.clearInterval(timer);
      if (cancelled) reject(new Error('Recording cancelled'));
      else resolve(new Blob(chunks, { type: (recorder.mimeType || mimeType || 'video/webm').split(';')[0] }));
    };
  });
  ended.catch(() => undefined);
  const started = Date.now();
  const max = Math.min(options.maxSeconds ?? RECORDING_LIMITS.maxSeconds, RECORDING_LIMITS.maxSeconds);
  const timer = window.setInterval(() => {
    const seconds = Math.floor((Date.now() - started) / 1000);
    options.onTick?.(seconds);
    if (seconds >= max && recorder.state === 'recording') recorder.stop();
  }, 250);
  // The reporter pressed "Stop sharing" in the browser.
  display.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (recorder.state === 'recording') recorder.stop();
  });
  recorder.start(1000);

  return {
    mimeType: (recorder.mimeType || mimeType || 'video/webm').split(';')[0]!,
    ended,
    stop() {
      if (recorder.state === 'recording') recorder.stop();
      return ended;
    },
    cancel() {
      cancelled = true;
      if (recorder.state === 'recording') recorder.stop();
      else stopTracks();
    },
  };
}
