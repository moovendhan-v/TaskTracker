import { canCaptureScreen, captureScreenshot, detectEnvironment, pickElement, startRecording, type PickedElement, type Recording } from '@taskflow/bug-capture';
import {
  BUG_ENVIRONMENT_LABELS,
  BUG_ENVIRONMENTS,
  BUG_KIND_LABELS,
  BUG_KINDS,
  BUG_LIMITS,
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
  isFailedRequest,
  type BugEnvironment,
  type BugKind,
  type BugSeverity,
} from '@taskflow/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { CameraIcon, CircleStopIcon, CrosshairIcon, MicIcon, TriangleAlertIcon, VideoIcon, XIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { formatBytes } from '@/lib/upload';
import { queryKeys } from '@/lib/query-keys';
import { attachmentsApi } from '@/modules/tasks';
import { bugsApi } from '../api/bugs.api';
import { useSimilarBugs } from '../hooks/use-bugs';
import { appRecorder } from '../lib/capture-session';
import { AnnotationEditor } from './annotation-editor';

type Phase = 'form' | 'annotating' | 'hidden' | 'recording';
const MAX_UPLOAD = 10 * 1024 * 1024;

interface Props {
  workspaceId: string;
  spaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (taskId: string) => void;
  onOpenExisting?: (taskId: string) => void;
}

/**
 * Report a bug or give feedback, from anywhere in the app: what was expected and what happened,
 * with an annotated screenshot, a screen recording (optionally with the microphone), the element
 * at fault, and the page's recent console, errors, requests and clicks (redacted). Mount it only
 * while open, so every report starts from a blank form.
 */
export function ReportBugDialog({ workspaceId, spaceId, open, onOpenChange, onCreated, onOpenExisting }: Props) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('form');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<BugKind>('bug');
  const [severity, setSeverity] = useState<BugSeverity>('P2');
  const [environment, setEnvironment] = useState<BugEnvironment>(import.meta.env.PROD ? 'production' : 'development');
  const [module, setModule] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [steps, setSteps] = useState('');
  const [diagnostics, setDiagnostics] = useState(true);
  const [rawShot, setRawShot] = useState<Blob | null>(null);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [video, setVideo] = useState<Blob | null>(null);
  const [microphone, setMicrophone] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [element, setElement] = useState<PickedElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // What would be sent, computed when the dialog opens (the recorder keeps running underneath).
  const capture = useMemo(() => (open ? appRecorder.snapshot() : null), [open]);
  const context = useMemo(() => (open ? detectEnvironment() : null), [open]);
  const errors = capture ? capture.console.filter((entry) => entry.level === 'error').length : 0;
  const failed = capture ? capture.network.filter(isFailedRequest).length : 0;

  const deferredTitle = useDeferredValue(title);
  const similar = useSimilarBugs(workspaceId, spaceId, deferredTitle);

  const hideWhile = async <T,>(work: () => Promise<T>): Promise<T | null> => {
    setPhase('hidden');
    // Let the dialog close before the page is captured.
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      return await work();
    } catch (error) {
      if ((error as Error).name !== 'NotAllowedError' && (error as Error).name !== 'AbortError') toast.error(getErrorMessage(error));
      return null;
    }
  };

  const takeScreenshot = async () => {
    const shot = await hideWhile(captureScreenshot);
    if (shot) {
      setRawShot(shot);
      setPhase('annotating');
    } else setPhase('form');
  };

  const pick = async () => {
    const picked = await hideWhile(() => pickElement());
    if (picked) setElement(picked);
    setPhase('form');
  };

  const record = async () => {
    const started = await hideWhile(() => startRecording({ microphone, onTick: setSeconds }));
    if (!started) {
      setPhase('form');
      return;
    }
    setSeconds(0);
    setRecording(started);
    setPhase('recording');
    started.ended.then(
      (blob) => {
        setVideo(blob);
        setRecording(null);
        setPhase('form');
      },
      () => {
        setRecording(null);
        setPhase('form');
      },
    );
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error('Give the report a title');
      return;
    }
    if (video && video.size > MAX_UPLOAD) {
      toast.error(`The recording is ${formatBytes(video.size)}; the limit is 10 MB. Record a shorter clip.`);
      return;
    }
    setSubmitting(true);
    try {
      const manual = steps
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, BUG_LIMITS.steps);
      if (element) manual.push(`Look at “${element.description}” (${element.selector})`.slice(0, BUG_LIMITS.stepText));
      const bug = await bugsApi.report(workspaceId, {
        spaceId,
        title: title.trim(),
        kind,
        severity,
        environment,
        module: module.trim() || null,
        expected: expected.trim() || null,
        actual: actual.trim() || null,
        steps: manual,
        context,
        captureJson: diagnostics ? JSON.stringify(appRecorder.snapshot()) : null,
      });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const files = [
        screenshot ? new File([screenshot], `screenshot-${stamp}.png`, { type: 'image/png' }) : null,
        video ? new File([video], `recording-${stamp}.${video.type.includes('mp4') ? 'mp4' : 'webm'}`, { type: video.type }) : null,
      ].filter((file): file is File => file !== null);
      for (const file of files) {
        setProgress(`Uploading ${file.name}…`);
        try {
          await attachmentsApi.upload(workspaceId, bug.taskId, file, () => undefined);
        } catch (error) {
          toast.error(`Report filed, but ${file.name} didn't upload: ${getErrorMessage(error)}`);
        }
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot(workspaceId) });
      toast.success(`Filed #${bug.number}`);
      onOpenChange(false);
      onCreated?.(bug.taskId);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  const screenAvailable = canCaptureScreen();

  return (
    <>
      <Dialog open={open && (phase === 'form' || phase === 'annotating')} onOpenChange={(next) => (phase === 'annotating' ? setPhase('form') : onOpenChange(next))}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" data-bug-capture-ignore="">
          <DialogHeader>
            <DialogTitle>{phase === 'annotating' ? 'Mark up the screenshot' : 'Report a bug or give feedback'}</DialogTitle>
            <DialogDescription>
              {phase === 'annotating' ? 'Point at the problem; pixelate anything private before it is saved.' : 'It becomes a bug task in this project, with everything a developer needs to reproduce it.'}
            </DialogDescription>
          </DialogHeader>

          {phase === 'annotating' && rawShot ? (
            <AnnotationEditor
              image={rawShot}
              onCancel={() => {
                setRawShot(null);
                setPhase('form');
              }}
              onDone={(annotated) => {
                setScreenshot(annotated);
                setRawShot(null);
                setPhase('form');
              }}
            />
          ) : (
            <form
              className="grid gap-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <FormField id="bug-title" label="Title">
                <Input id="bug-title" autoFocus placeholder="e.g. Saving a sprint shows an error" maxLength={BUG_LIMITS.title} value={title} onChange={(event) => setTitle(event.target.value)} />
              </FormField>
              {similar.data?.length ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs" role="status">
                  <p className="mb-1 flex items-center gap-1 font-medium">
                    <TriangleAlertIcon className="size-3.5 text-warning" /> Similar reports already exist
                  </p>
                  <ul className="grid gap-0.5">
                    {similar.data.map((bug) => (
                      <li key={bug.taskId}>
                        <button type="button" className="text-left hover:underline" onClick={() => onOpenExisting?.(bug.taskId)}>
                          #{bug.number} {bug.title} <span className="text-muted-foreground">· {Math.round(bug.score * 100)}% alike</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Choice label="Kind" value={kind} onChange={(value) => setKind(value as BugKind)} options={BUG_KINDS.map((value) => [value, BUG_KIND_LABELS[value]])} />
                <Choice label="Severity" value={severity} onChange={(value) => setSeverity(value as BugSeverity)} options={BUG_SEVERITIES.map((value) => [value, BUG_SEVERITY_LABELS[value]])} />
                <Choice label="Environment" value={environment} onChange={(value) => setEnvironment(value as BugEnvironment)} options={BUG_ENVIRONMENTS.map((value) => [value, BUG_ENVIRONMENT_LABELS[value]])} />
                <FormField id="bug-module" label="Module">
                  <Input id="bug-module" placeholder="e.g. Billing" maxLength={BUG_LIMITS.module} value={module} onChange={(event) => setModule(event.target.value)} />
                </FormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="bug-expected" label="Expected result">
                  <Textarea id="bug-expected" rows={3} maxLength={BUG_LIMITS.text} value={expected} onChange={(event) => setExpected(event.target.value)} />
                </FormField>
                <FormField id="bug-actual" label="Actual result">
                  <Textarea id="bug-actual" rows={3} maxLength={BUG_LIMITS.text} value={actual} onChange={(event) => setActual(event.target.value)} />
                </FormField>
              </div>
              <FormField id="bug-steps" label="Steps to reproduce (one per line; your recent clicks are added automatically)">
                <Textarea id="bug-steps" rows={3} placeholder={'Open the sprint\nClick “Complete sprint”'} value={steps} onChange={(event) => setSteps(event.target.value)} />
              </FormField>

              <div className="grid gap-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Show it</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void takeScreenshot()} disabled={!screenAvailable}>
                    <CameraIcon className="mr-1 size-4" /> {screenshot ? 'Retake screenshot' : 'Screenshot'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void record()} disabled={!screenAvailable}>
                    <VideoIcon className="mr-1 size-4" /> {video ? 'Record again' : 'Record screen'}
                  </Button>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={microphone} onCheckedChange={(value) => setMicrophone(value === true)} aria-label="Record my microphone" />
                    <MicIcon className="size-3.5" /> with microphone
                  </label>
                  <Button variant="outline" size="sm" onClick={() => void pick()}>
                    <CrosshairIcon className="mr-1 size-4" /> {element ? 'Pick another element' : 'Pick the element'}
                  </Button>
                </div>
                {!screenAvailable ? <p className="text-xs text-muted-foreground">This browser can't capture the screen; attach files on the task instead.</p> : null}
                <div className="flex flex-wrap gap-2">
                  {screenshot ? <Attached label={`Screenshot · ${formatBytes(screenshot.size)}`} onRemove={() => setScreenshot(null)} preview={screenshot} /> : null}
                  {video ? <Attached label={`Recording · ${formatBytes(video.size)}`} onRemove={() => setVideo(null)} /> : null}
                  {element ? <Attached label={`Element · ${element.description}`} onRemove={() => setElement(null)} /> : null}
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={diagnostics} onCheckedChange={(value) => setDiagnostics(value === true)} className="mt-0.5" />
                <span>
                  Include diagnostics
                  <span className="block text-xs text-muted-foreground">
                    {capture ? `${capture.console.length} console lines (${errors} errors), ${capture.network.length} requests (${failed} failed), ${capture.actions.length} actions` : ''}
                    {context ? ` · ${[context.browser, context.os, context.viewport].filter(Boolean).join(', ')}` : ''}. Passwords, tokens and cookies are removed.
                  </span>
                </span>
              </label>

              <DialogFooter className="items-center">
                {progress ? <span className="mr-auto text-xs text-muted-foreground">{progress}</span> : null}
                <Button type="submit" disabled={submitting || !title.trim()}>
                  {submitting ? 'Filing…' : 'File report'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {phase === 'recording' && recording
        ? createPortal(
            <div data-bug-capture-ignore="" role="status" className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">
              <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
              Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} / 1:00
              <Button size="sm" variant="secondary" className="h-7 rounded-full" onClick={() => void recording.stop()}>
                <CircleStopIcon className="mr-1 size-4" /> Stop
              </Button>
              <Button size="sm" variant="ghost" className="h-7 rounded-full text-background hover:bg-background/20" onClick={() => recording.cancel()}>
                Cancel
              </Button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  const id = `bug-${label.toLowerCase()}`;
  return (
    <FormField id={id} label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([option, text]) => (
            <SelectItem key={option} value={option}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function Attached({ label, onRemove, preview }: { label: string; onRemove: () => void; preview?: Blob }) {
  const url = useMemo(() => (preview ? URL.createObjectURL(preview) : null), [preview]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return (
    <span className="flex max-w-full items-center gap-2 rounded-md border bg-muted/50 py-1 pr-1 pl-2 text-xs">
      {url ? <img src={url} alt="" className="h-8 w-12 rounded object-cover" /> : null}
      <span className="truncate">{label}</span>
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <XIcon className="size-3.5" />
      </button>
    </span>
  );
}
