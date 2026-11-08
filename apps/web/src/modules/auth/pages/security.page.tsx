import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2Icon, CopyIcon, DownloadIcon, KeyRoundIcon, ShieldCheckIcon, ShieldIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { encode } from 'uqr';
import { PageHeader } from '@/components/common/page-header';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '../api/auth.api';

const KEY = ['auth', 'two-factor'] as const;

/** A QR code as an SVG drawn from the encoder's modules: nothing leaves the browser. */
function QrCode({ value, label }: { value: string; label: string }) {
  const { data, size } = encode(value, { ecc: 'M', border: 2 });
  const cells: string[] = [];
  data.forEach((row, y) => row.forEach((on, x) => on && cells.push(`M${x} ${y}h1v1h-1z`)));
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} className="size-44 rounded-lg border bg-white p-1" shapeRendering="crispEdges">
      <path d={cells.join('')} fill="#000" />
    </svg>
  );
}

/** The secret in the authenticator link, for typing it in by hand. */
function secretOf(uri: string): string {
  try {
    return new URL(uri).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

function BackupCodes({ codes }: { codes: readonly string[] }) {
  const text = codes.join('\n');
  const download = () => {
    const url = URL.createObjectURL(new Blob([`TaskFlow backup codes (each works once)\n\n${text}\n`], { type: 'text/plain' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'taskflow-backup-codes.txt' });
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="grid gap-2">
      <ul aria-label="Backup codes" className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(text).then(() => notify.success('Copied'))}>
          <CopyIcon /> Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <DownloadIcon /> Download
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Keep these somewhere safe. Each one signs you in once if you lose your device; they won't be shown again.</p>
    </div>
  );
}

/**
 * Account security (A4): two-step sign-in with an authenticator app. Turning it on
 * asks for your password, shows a QR code and backup codes, and only takes effect
 * once you've entered a code from the app; turning it off asks for your password.
 */
export function SecurityPage() {
  const queryClient = useQueryClient();
  const enabled = useQuery({ queryKey: KEY, queryFn: () => authApi.twoFactorEnabled() });
  const [password, setPassword] = useState('');
  const [setup, setSetup] = useState<{ uri: string; codes: string[] } | null>(null);
  const [code, setCode] = useState('');
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const done = () => {
    setPassword('');
    setCode('');
    void queryClient.invalidateQueries({ queryKey: KEY });
  };

  const start = useMutation({
    mutationFn: () => authApi.enableTwoFactor(password),
    onSuccess: (data) => {
      if (data.method !== 'totp') return notify.error(new Error('Unexpected answer from the server'));
      setSetup({ uri: data.totpURI, codes: data.backupCodes });
      setPassword('');
    },
    onError: (error) => notify.error(error),
  });
  const confirm = useMutation({
    mutationFn: () => authApi.verifyTotp(code.replace(/\D/g, ''), false),
    onSuccess: () => {
      notify.success('Two-step sign-in is on');
      setSetup(null);
      done();
    },
    onError: (error) => notify.error(error),
  });
  const turnOff = useMutation({
    mutationFn: () => authApi.disableTwoFactor(password),
    onSuccess: () => {
      notify.success('Two-step sign-in is off');
      done();
    },
    onError: (error) => notify.error(error),
  });
  const regenerate = useMutation({
    mutationFn: () => authApi.newBackupCodes(password),
    onSuccess: (data) => {
      setFreshCodes(data.backupCodes);
      setPassword('');
    },
    onError: (error) => notify.error(error),
  });

  const on = enabled.data === true;
  const submitPassword = (action: () => void) => (event: FormEvent) => {
    event.preventDefault();
    if (password) action();
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader title="Security" description="How you sign in" icon={<ShieldIcon className="size-5 text-muted-foreground" />} />
      <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {on ? <ShieldCheckIcon className="size-4 text-good" /> : <KeyRoundIcon className="size-4 text-muted-foreground" />} Two-step sign-in
            </CardTitle>
            <CardDescription>
              {on ? 'On: signing in asks for a code from your authenticator app after your password.' : 'Add a code from an authenticator app (1Password, Google Authenticator, Authy…) after your password.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {setup ? (
              <div className="grid gap-4 animate-in fade-in-0 slide-in-from-top-1">
                <div className="flex flex-wrap items-start gap-4">
                  <QrCode value={setup.uri} label="QR code for your authenticator app" />
                  <div className="grid min-w-0 flex-1 gap-2 text-sm">
                    <p className="font-medium">1. Scan this with your authenticator app</p>
                    <p className="text-muted-foreground">Or enter this key by hand:</p>
                    <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs break-all">{secretOf(setup.uri)}</code>
                  </div>
                </div>
                <div className="grid gap-2">
                  <p className="text-sm font-medium">2. Save your backup codes</p>
                  <BackupCodes codes={setup.codes} />
                </div>
                <form
                  className="grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (code.replace(/\D/g, '').length === 6) confirm.mutate();
                  }}
                >
                  <Label htmlFor="confirm-code">3. Enter the 6-digit code the app shows</Label>
                  <div className="flex gap-2">
                    <Input id="confirm-code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputMode="numeric" maxLength={9} className="w-40 font-mono tracking-[0.3em]" />
                    <Button type="submit" disabled={code.replace(/\D/g, '').length !== 6 || confirm.isPending}>
                      <CheckCircle2Icon /> Turn on
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <form className="grid gap-2" onSubmit={submitPassword(() => (on ? turnOff.mutate() : start.mutate()))}>
                <Label htmlFor="security-password">Your password</Label>
                <div className="flex flex-wrap gap-2">
                  <Input id="security-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-64" />
                  {on ? (
                    <>
                      <Button type="submit" variant="outline" disabled={!password || turnOff.isPending}>
                        Turn off
                      </Button>
                      <Button type="button" variant="ghost" disabled={!password || regenerate.isPending} onClick={() => regenerate.mutate()}>
                        New backup codes
                      </Button>
                    </>
                  ) : (
                    <Button type="submit" disabled={!password || start.isPending}>
                      Set up
                    </Button>
                  )}
                </div>
              </form>
            )}
            {freshCodes ? (
              <div className="grid gap-2">
                <p className="text-sm font-medium">Your new backup codes (the old ones no longer work)</p>
                <BackupCodes codes={freshCodes} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
