import { useMutation, useQuery } from '@tanstack/react-query';
import type { BugKind, PublicReportResponse } from '@taskflow/shared-types';
import { BUG_LIMITS } from '@taskflow/shared-types';
import { CheckCircle2Icon, ImageIcon, XIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TurnstileWidget } from '@/core/auth/turnstile-widget';
import { publicFeedbackApi } from '../api/intake.api';

const MAX_SCREENSHOT = 650_000;

/** An image file as a JPEG data URL small enough for one request. */
async function toScreenshot(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Pick a PNG, JPEG or WebP image');
  const bitmap = await createImageBitmap(file);
  for (const [width, quality] of [[1600, 0.8], [1280, 0.7], [1024, 0.6]] as const) {
    const scale = Math.min(1, width / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length * 0.75 <= MAX_SCREENSHOT) return url;
  }
  throw new Error('That image is too large');
}

/**
 * The hosted feedback portal (/f/:key): clients and testers without a TaskFlow account report a
 * bug or an idea for one project, and get a link to follow it. Public; the API checks the key,
 * the origin, the CAPTCHA and rate limits.
 */
export function FeedbackPortalPage({ publicKey }: { publicKey: string }) {
  const config = useQuery({ queryKey: ['public-intake', publicKey], queryFn: () => publicFeedbackApi.config(publicKey), retry: false });
  const [kind, setKind] = useState<BugKind>('bug');
  const [title, setTitle] = useState('');
  const [actual, setActual] = useState('');
  const [expected, setExpected] = useState('');
  const [steps, setSteps] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PublicReportResponse | null>(null);

  const send = useMutation({
    mutationFn: () =>
      publicFeedbackApi.report(publicKey, {
        via: 'portal',
        kind,
        title: title.trim(),
        actual: actual.trim() || null,
        expected: expected.trim() || null,
        steps: steps.split('\n').map((line) => line.trim()).filter(Boolean),
        name: name.trim() || null,
        email: email.trim() || null,
        context: { browser: null, pageUrl: null, viewport: `${window.innerWidth}x${window.innerHeight}`, userAgent: navigator.userAgent.slice(0, 500) },
        screenshot,
        captchaToken: captcha,
        website: website || null,
      }),
    onSuccess: setDone,
    onError: (failure) => setError(failure instanceof Error ? failure.message : 'Your report couldn’t be sent'),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (title.trim().length < 3) return setError('Add a short summary');
    send.mutate();
  };

  if (config.isLoading) return <FullPageSpinner />;
  if (!config.data?.portal) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>This feedback page isn’t available</CardTitle>
            <CardDescription>The link may be old, or feedback is switched off for now. Ask the team that sent it for a new one.</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (done) {
    const tracking = `${window.location.origin}${done.trackingPath}`;
    return (
      <Shell>
        <Card role="status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-good">
              <CheckCircle2Icon className="size-5" /> Thank you, we got it (#{done.number})
            </CardTitle>
            <CardDescription>Keep this link to follow its progress. It’s the only copy.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <a href={done.trackingPath} className="font-mono text-xs break-all text-primary hover:underline" data-testid="tracking-link">
              {tracking}
            </a>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void navigator.clipboard.writeText(tracking)}>
                Copy link
              </Button>
              <Button variant="ghost" onClick={() => window.location.reload()}>
                Send another
              </Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card role="region" aria-label="Feedback form">
        <CardHeader>
          <CardTitle>{config.data.title}</CardTitle>
          {config.data.intro ? <CardDescription className="whitespace-pre-wrap">{config.data.intro}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit} noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="portal-kind">This is</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as BugKind)}>
                <SelectTrigger id="portal-kind" aria-label="This is">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Something is broken</SelectItem>
                  <SelectItem value="suggestion">A suggestion</SelectItem>
                  <SelectItem value="enhancement">An improvement</SelectItem>
                  <SelectItem value="feature_request">A feature request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="portal-title">Summary</Label>
              <Input id="portal-title" maxLength={BUG_LIMITS.title} value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="portal-actual">What happened?</Label>
              <Textarea id="portal-actual" rows={3} maxLength={BUG_LIMITS.text} value={actual} onChange={(event) => setActual(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="portal-expected">What did you expect? (optional)</Label>
              <Textarea id="portal-expected" rows={2} maxLength={BUG_LIMITS.text} value={expected} onChange={(event) => setExpected(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="portal-steps">Steps to reproduce (optional, one per line)</Label>
              <Textarea id="portal-steps" rows={3} value={steps} onChange={(event) => setSteps(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Screenshot (optional)</span>
              {screenshot ? (
                <div className="flex items-center gap-2">
                  <img src={screenshot} alt="Your screenshot" className="h-16 rounded border object-cover" />
                  <Button variant="ghost" size="sm" onClick={() => setScreenshot(null)}>
                    <XIcon className="mr-1 size-3.5" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                  <ImageIcon className="size-4" /> Choose an image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    aria-label="Screenshot"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void toScreenshot(file).then(setScreenshot, (failure: Error) => setError(failure.message));
                    }}
                  />
                </label>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="portal-name">Your name (optional)</Label>
                <Input id="portal-name" maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="portal-email">Email (optional, for follow-up)</Label>
                <Input id="portal-email" type="email" maxLength={200} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>
            {/* People never see this field; bots fill it in. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[10000px] h-px w-px opacity-0" value={website} onChange={(event) => setWebsite(event.target.value)} />
            <TurnstileWidget action="feedback" onToken={setCaptcha} />
            {error ? (
              <p role="alert" className="text-sm text-critical">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={send.isPending}>
                {send.isPending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted/30">
      <main className="mx-auto grid max-w-2xl gap-4 px-4 py-10">{children}</main>
      <footer className="pb-6 text-center text-xs text-muted-foreground">Powered by TaskFlow</footer>
    </div>
  );
}
