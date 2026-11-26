import { useQuery } from '@tanstack/react-query';
import { BUG_ENVIRONMENT_LABELS, BUG_KIND_LABELS, BUG_QA_STATE_LABELS, BUG_SEVERITY_LABELS } from '@taskflow/shared-types';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { publicFeedbackApi } from '../api/intake.api';
import { CaptureView } from '../components/capture-view';
import { QA_TONE, SEVERITY_TONE } from '../lib/bug-meta';
import { Shell } from './feedback-portal.page';

/** Where a QA state stands, in words for someone outside the team. */
const PLAIN: Record<string, string> = {
  new: 'Received: the team hasn’t looked at it yet.',
  confirmed: 'Confirmed: the team can see the problem.',
  fixed: 'Fixed: waiting to be checked.',
  retest: 'Being checked again.',
  verified: 'Verified as fixed.',
  reopened: 'Reopened: it wasn’t fully fixed.',
  closed: 'Closed.',
  duplicate: 'Already reported: it’s being handled under another report.',
  wont_fix: 'Closed without a change.',
};

/**
 * A read-only report from a link: /s/:token (shared by the team: details, files, diagnostics) or
 * /f/track/:token (the reporter's own: status only). Public; the link is the permission.
 */
export function PublicBugPage({ token }: { token: string }) {
  const view = useQuery({ queryKey: ['public-bug', token], queryFn: () => publicFeedbackApi.view(token), retry: false, refetchInterval: 60_000 });
  if (view.isLoading) return <FullPageSpinner />;
  const bug = view.data;
  if (!bug) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>This link doesn’t work any more</CardTitle>
            <CardDescription>It may have expired or been turned off. Ask the person who sent it for a new one.</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }
  const full = bug.scope === 'full';
  return (
    <Shell>
      <Card role="region" aria-label="Report">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {bug.severity ? <span className={cn('rounded px-1.5 py-0.5 font-semibold', SEVERITY_TONE[bug.severity])}>{BUG_SEVERITY_LABELS[bug.severity]}</span> : null}
            <span className={cn('rounded px-1.5 py-0.5 font-medium', QA_TONE[bug.qaState])} data-testid="qa-state">
              {BUG_QA_STATE_LABELS[bug.qaState]}
            </span>
            <span className="text-muted-foreground">
              #{bug.number} · {BUG_KIND_LABELS[bug.kind]} · {bug.statusName}
            </span>
          </div>
          <CardTitle className="text-xl">{bug.title}</CardTitle>
          <CardDescription>
            {PLAIN[bug.qaState]} Reported {new Date(bug.createdAt).toLocaleDateString()}, last updated {new Date(bug.updatedAt).toLocaleString()}.
          </CardDescription>
        </CardHeader>
        {full ? (
          <CardContent className="grid gap-5">
            {bug.files.length ? (
              <div className="grid gap-3">
                {bug.files.map((file) =>
                  file.isVideo ? (
                    <video key={file.url} src={file.url} controls preload="metadata" className="max-h-96 w-full rounded-lg border bg-black" aria-label={file.fileName} />
                  ) : file.isImage ? (
                    <img key={file.url} src={file.url} alt={file.fileName} className="max-h-96 w-full rounded-lg border object-contain" />
                  ) : (
                    <a key={file.url} href={file.url} className="text-sm text-primary hover:underline">
                      {file.fileName}
                    </a>
                  ),
                )}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Block title="Expected">{bug.expected}</Block>
              <Block title="Actual">{bug.actual}</Block>
            </div>
            {bug.steps.length ? (
              <div>
                <h3 className="mb-1 text-sm font-semibold">Steps to reproduce</h3>
                <ol className="list-decimal pl-5 text-sm">
                  {bug.steps.map((step, index) => (
                    <li key={index}>{step.text}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {[bug.environment ? BUG_ENVIRONMENT_LABELS[bug.environment] : null, bug.browser, bug.os, bug.viewport].filter(Boolean).join(' · ')}
              {bug.pageUrl ? <span className="block truncate">{bug.pageUrl}</span> : null}
            </p>
            {bug.capture ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Diagnostics</h3>
                <CaptureView capture={bug.capture} />
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>
      <p className="text-center text-xs text-muted-foreground">Read-only link · works until {new Date(bug.expiresAt).toLocaleDateString()}</p>
    </Shell>
  );
}

function Block({ title, children }: { title: string; children: string | null }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className={cn('text-sm whitespace-pre-wrap', !children && 'text-muted-foreground')}>{children || 'Not given.'}</p>
    </div>
  );
}
