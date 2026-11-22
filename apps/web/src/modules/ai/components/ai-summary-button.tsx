import { CopyIcon, LoaderCircleIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import type { SummaryTarget } from '../api/ai.api';
import { useAiSettings, useSummarize } from '../hooks/use-ai';

/**
 * "Summarise" with AI, for a task, a doc page or a chat conversation. Hidden unless the
 * workspace turned AI on. The answer is a model's plain text: shown as text (never HTML),
 * labelled as AI, and not saved anywhere.
 */
export function AiSummaryButton({ workspaceId, target, label = 'Summarise', what }: { workspaceId: string; target: SummaryTarget; label?: string; what: string }) {
  const settings = useAiSettings(workspaceId);
  const summarize = useSummarize(workspaceId);
  const [open, setOpen] = useState(false);
  if (!settings.data?.enabled) return null;

  const run = () =>
    summarize.mutate(target, {
      onError: (error) => {
        setOpen(false);
        toast.error(getErrorMessage(error));
      },
    });
  const summary = summarize.data;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !summarize.isPending && !summary) run();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`${label} ${what} with AI`}>
          <SparklesIcon /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2rem))] p-0" aria-label={`AI summary of ${what}`}>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <SparklesIcon className="size-4 text-primary" />
          <span className="text-sm font-medium">AI summary</span>
          {summary ? (
            <span className="truncate text-xs text-muted-foreground">
              {summary.providerLabel} · {summary.model}
            </span>
          ) : null}
          <span className="flex-1" />
          <Button variant="ghost" size="icon-sm" aria-label="Summarise again" disabled={summarize.isPending} onClick={run}>
            <RefreshCwIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy summary"
            disabled={!summary}
            onClick={() => summary && void navigator.clipboard.writeText(summary.text).then(() => toast.success('Summary copied'))}
          >
            <CopyIcon />
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto px-3 py-2.5">
          {summarize.isPending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" /> Reading {what}…
            </p>
          ) : summary ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="ai-summary">
              {summary.text}
            </p>
          ) : null}
        </div>
        {summary ? (
          <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            AI can get things wrong; check before relying on it. {summary.usedToday.toLocaleString()} of {summary.dailyTokens.toLocaleString()} tokens used today.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
