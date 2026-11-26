import { isFailedRequest, type BugCaptureResponse, type NetworkEntry } from '@taskflow/shared-types';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { captureTime } from '../lib/bug-meta';

const LEVEL_TONE: Record<string, string> = { error: 'text-critical', warn: 'text-warning', info: 'text-chart-1', debug: 'text-muted-foreground', log: 'text-foreground' };

/** Console, network and user actions captured with the report (already redacted on the server). */
export function CaptureView({ capture }: { capture: BugCaptureResponse }) {
  const [onlyFailed, setOnlyFailed] = useState(false);
  const errors = capture.console.filter((entry) => entry.level === 'error').length;
  const failed = capture.network.filter(isFailedRequest).length;
  const requests = onlyFailed ? capture.network.filter(isFailedRequest) : capture.network;
  return (
    <Tabs defaultValue={errors || !failed ? 'console' : 'network'}>
      <TabsList>
        <TabsTrigger value="console">Console {errors ? <span className="ml-1 text-critical">{errors}</span> : null}</TabsTrigger>
        <TabsTrigger value="network">Network {failed ? <span className="ml-1 text-critical">{failed}</span> : null}</TabsTrigger>
        <TabsTrigger value="actions">Actions</TabsTrigger>
      </TabsList>
      <TabsContent value="console" className="mt-2">
        {capture.console.length ? (
          <ol aria-label="Console" className="max-h-80 overflow-auto rounded-md border font-mono text-xs">
            {capture.console.map((entry, index) => (
              <li key={index} className={cn('grid grid-cols-[4rem_1fr] gap-2 border-b px-2 py-1 last:border-0', entry.level === 'error' && 'bg-critical/5')}>
                <span className="text-muted-foreground tabular-nums">{captureTime(entry.at)}</span>
                <div className="min-w-0">
                  <span className={cn('mr-1 font-semibold uppercase', LEVEL_TONE[entry.level])}>{entry.uncaught ? 'uncaught' : entry.level}</span>
                  <span className="break-words whitespace-pre-wrap">{entry.message}</span>
                  {entry.stack ? (
                    <details className="mt-0.5">
                      <summary className="cursor-pointer text-muted-foreground">Stack</summary>
                      <pre className="whitespace-pre-wrap text-muted-foreground">{entry.stack}</pre>
                    </details>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>No console output was captured.</Empty>
        )}
      </TabsContent>
      <TabsContent value="network" className="mt-2 grid gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={onlyFailed} onChange={(event) => setOnlyFailed(event.target.checked)} /> Failed requests only
        </label>
        {requests.length ? (
          <ol aria-label="Network" className="max-h-80 overflow-auto rounded-md border font-mono text-xs">
            {requests.map((entry, index) => (
              <Request key={index} entry={entry} />
            ))}
          </ol>
        ) : (
          <Empty>{onlyFailed ? 'No failed requests.' : 'No requests were captured.'}</Empty>
        )}
      </TabsContent>
      <TabsContent value="actions" className="mt-2">
        {capture.actions.length ? (
          <ol aria-label="User actions" className="max-h-80 overflow-auto rounded-md border text-xs">
            {capture.actions.map((action, index) => (
              <li key={index} className="grid grid-cols-[4rem_4.5rem_1fr] gap-2 border-b px-2 py-1 last:border-0">
                <span className="font-mono text-muted-foreground tabular-nums">{captureTime(action.at)}</span>
                <span className="font-medium">{action.type}</span>
                <span className="min-w-0 truncate" title={action.selector ?? undefined}>
                  {action.type === 'navigate' ? action.url : action.target}
                  {action.value && action.type !== 'navigate' ? <span className="text-muted-foreground"> · {action.value}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>No actions were captured.</Empty>
        )}
      </TabsContent>
    </Tabs>
  );
}

function Request({ entry }: { entry: NetworkEntry }) {
  const bad = isFailedRequest(entry);
  const headers = (title: string, values?: Record<string, string>) =>
    values && Object.keys(values).length ? (
      <div>
        <p className="font-semibold">{title}</p>
        {Object.entries(values).map(([name, value]) => (
          <p key={name} className="break-all">
            <span className="text-muted-foreground">{name}:</span> {value}
          </p>
        ))}
      </div>
    ) : null;
  return (
    <li className={cn('border-b last:border-0', bad && 'bg-critical/5')}>
      <details>
        <summary className="grid cursor-pointer grid-cols-[4rem_3.5rem_2.5rem_1fr_3.5rem] gap-2 px-2 py-1">
          <span className="text-muted-foreground tabular-nums">{captureTime(entry.at)}</span>
          <span className="font-semibold">{entry.method}</span>
          <span className={cn('tabular-nums', bad ? 'font-semibold text-critical' : 'text-good')}>{entry.status || '—'}</span>
          <span className="min-w-0 truncate" title={entry.url}>
            {entry.url}
          </span>
          <span className="text-right text-muted-foreground tabular-nums">{entry.durationMs} ms</span>
        </summary>
        <div className="grid gap-2 bg-muted/40 px-3 py-2">
          {entry.error ? <p className="text-critical">{entry.error}</p> : null}
          <p className="break-all">{entry.url}</p>
          {headers('Request headers', entry.requestHeaders)}
          {entry.requestBody ? (
            <div>
              <p className="font-semibold">Request body</p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap">{entry.requestBody}</pre>
            </div>
          ) : null}
          {headers('Response headers', entry.responseHeaders)}
          {entry.responseBody ? (
            <div>
              <p className="font-semibold">Response body</p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap">{entry.responseBody}</pre>
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">{children}</p>;
}
