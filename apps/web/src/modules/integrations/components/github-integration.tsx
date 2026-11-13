import { ArrowRightIcon, BlocksIcon, CopyIcon, ExternalLinkIcon, GitPullRequestIcon, HistoryIcon, InboxIcon, KeyRoundIcon, LinkIcon, PlusIcon, TrashIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DEFAULT_GITHUB_SYNC,
  DEFAULT_TASK_PREFIX,
  STATUS_CATEGORIES,
  type GithubConnectionResponse,
  type GithubSyncSettings,
  type StatusCategory,
} from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Modal } from '@/components/kit/modal';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { formatLongDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import {
  useGithubApp,
  useGithubAppMutations,
  useGithubConnections,
  useGithubInbox,
  useGithubInboxMutations,
  useGithubMutations,
  useGithubSyncLog,
  useInstallationRepositories,
} from '../hooks/use-integrations';

const NONE = 'none';
const CATEGORY_LABELS: Record<StatusCategory, string> = {
  unstarted: 'Not started',
  started: 'Active',
  review: 'In review',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

interface Secret {
  url: string;
  secret: string;
  repo: string;
}

/**
 * Connected GitHub repositories. Each one gets a webhook URL and secret to add
 * in the repository's settings; pull requests that mention a task (TF-42) link
 * to it and can move it along.
 */
export function GithubIntegration({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const connections = useGithubConnections(workspaceId, canManage);
  const mutations = useGithubMutations(workspaceId);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [logFor, setLogFor] = useState<GithubConnectionResponse | null>(null);
  useGithubInstallResult();
  const showSecret = (result: { webhookSecret: string; connection: GithubConnectionResponse }) =>
    setSecret({ url: `${window.location.origin}${result.connection.webhookPath}`, secret: result.webhookSecret, repo: result.connection.repo });

  if (!canManage) return <p className="text-sm text-muted-foreground">People with the integration.manage permission can connect GitHub.</p>;

  return (
    <div className="grid gap-3">
      <GithubAppPanel workspaceId={workspaceId} />
      {connections.data?.length === 0 ? <p className="text-sm text-muted-foreground">No repositories connected.</p> : null}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {connections.data?.map((connection) => (
          <li key={connection.id} className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-start gap-3">
              <GitPullRequestIcon className="mt-0.5 size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {connection.repo}
                  {connection.viaApp ? <span className="ml-2 rounded-full bg-selected px-2 py-0.5 text-[11px] font-medium text-muted-foreground">GitHub App · two-way</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tasks are mentioned as {connection.taskPrefix}-42 ·{' '}
                  {connection.lastDeliveryAt
                    ? `${connection.viaApp ? 'last sync' : 'last delivery'} ${formatLongDate(connection.lastDeliveryAt)}: ${connection.lastDeliveryStatus}`
                    : connection.viaApp
                      ? 'first sync within a minute'
                      : 'nothing received yet'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLogFor(connection)}>
                <HistoryIcon /> Sync log
              </Button>
              {connection.viaApp ? null : (
                <Button variant="ghost" size="sm" onClick={() => mutations.rotate.mutate(connection.id, { onSuccess: showSecret })}>
                  <KeyRoundIcon /> New secret
                </Button>
              )}
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Disconnect ${connection.repo}`}>
                    <TrashIcon />
                  </Button>
                }
                title={`Disconnect ${connection.repo}?`}
                description={
                  connection.viaApp
                    ? 'Sync with this repository stops, and its pull request and issue links are removed. The app stays installed on GitHub.'
                    : 'Deliveries stop being accepted and its pull request links are removed. Remove the webhook in GitHub too.'
                }
                confirmLabel="Disconnect"
                onConfirm={() => mutations.disconnect.mutateAsync(connection.id)}
              />
            </div>
            <SyncSettings sync={connection.sync} onChange={(sync) => mutations.update.mutate({ connectionId: connection.id, body: { sync } })} />
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setAdding(true)}>
        <PlusIcon /> Connect a repository
      </Button>
      {adding ? (
        <ConnectDialog
          onClose={() => setAdding(false)}
          onConnect={async (repo, taskPrefix, sync) => {
            const result = await mutations.connect.mutateAsync({ repo, taskPrefix, sync });
            setAdding(false);
            showSecret(result);
          }}
        />
      ) : null}
      {secret ? <SecretDialog secret={secret} onClose={() => setSecret(null)} /> : null}
      {logFor ? <SyncLog workspaceId={workspaceId} connection={logFor} onClose={() => setLogFor(null)} /> : null}
      {connections.data?.length ? <PullRequestInbox workspaceId={workspaceId} /> : null}
    </div>
  );
}

const INSTALL_RESULTS: Record<string, { ok: boolean; text: string }> = {
  installed: { ok: true, text: 'The GitHub App is installed. Connect a repository to start syncing.' },
  updated: { ok: true, text: 'GitHub saved your changes to the app.' },
  'not-yours': { ok: false, text: 'GitHub doesn’t list that installation as one you can reach, or the link expired. Start again from here.' },
  failed: { ok: false, text: 'GitHub couldn’t confirm the installation. Try again.' },
  incomplete: { ok: false, text: 'GitHub didn’t finish the installation. Try again.' },
};

/** After GitHub sends you back (?github=…): says how it went, once, and tidies the address. */
function useGithubInstallResult() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = INSTALL_RESULTS[url.searchParams.get('github') ?? ''];
    if (!result) return;
    if (result.ok) toast.success(result.text);
    else toast.error(result.text);
    url.searchParams.delete('github');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);
}

/**
 * The TaskFlow GitHub App: install it on a GitHub account or organization, then connect its
 * repositories. Those sync both ways (pull requests and issues), with no webhook to set up.
 */
function GithubAppPanel({ workspaceId }: { workspaceId: string }) {
  const { info, installations } = useGithubApp(workspaceId, true);
  const mutations = useGithubAppMutations(workspaceId);
  const [connectFor, setConnectFor] = useState<{ id: string; accountLogin: string } | null>(null);
  if (!info.data?.enabled) return null;
  return (
    <section aria-label="GitHub App" className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <BlocksIcon className="mt-0.5 size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">TaskFlow GitHub App</p>
          <p className="text-xs text-muted-foreground">Two-way sync: pull requests move tasks, and issues opened from tasks keep their title and open / closed state in step. No webhook to set up.</p>
        </div>
        <Button size="sm" disabled={!info.data.canInstall || mutations.install.isPending} onClick={() => mutations.install.mutate()}>
          <ExternalLinkIcon /> Install on GitHub
        </Button>
      </div>
      {!info.data.canInstall ? <p className="text-xs text-muted-foreground">Installing from TaskFlow needs the app&rsquo;s client secret on the server (GITHUB_APP_CLIENT_SECRET).</p> : null}
      <p className="text-xs text-muted-foreground">
        {info.data.webhook ? (
          <>Changes on GitHub arrive at once through the app&rsquo;s webhook.</>
        ) : (
          <>
            Changes on GitHub are checked every minute. For instant updates, set the app&rsquo;s webhook on GitHub to{' '}
            <code className="font-mono">{`${window.location.origin}/api/integrations/github/app-webhook`}</code> and its secret as GITHUB_APP_WEBHOOK_SECRET.
          </>
        )}
      </p>
      {installations.data?.length ? (
        <ul aria-label="Installations" className="grid gap-2">
          {installations.data.map((installation) => (
            <li key={installation.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{installation.accountLogin}</span>
                <span className="text-muted-foreground"> · {installation.accountType === 'Organization' ? 'organization' : 'account'}</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => setConnectFor(installation)}>
                <PlusIcon /> Connect a repository
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${installation.accountLogin}`}>
                    <TrashIcon />
                  </Button>
                }
                title={`Remove ${installation.accountLogin}?`}
                description="Its repositories stop syncing here and their links are removed. To uninstall the app itself, use GitHub's settings."
                confirmLabel="Remove"
                onConfirm={() => mutations.remove.mutateAsync(installation.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {connectFor ? (
        <ConnectAppRepositoryDialog
          workspaceId={workspaceId}
          installation={connectFor}
          onClose={() => setConnectFor(null)}
          onConnect={async (repo, taskPrefix) => {
            const connection = await mutations.connect.mutateAsync({ installationId: connectFor.id, repo, taskPrefix });
            toast.success(`Connected ${connection.repo}; the first sync runs within a minute`);
            setConnectFor(null);
          }}
        />
      ) : null}
    </section>
  );
}

function ConnectAppRepositoryDialog({
  workspaceId,
  installation,
  onClose,
  onConnect,
}: {
  workspaceId: string;
  installation: { id: string; accountLogin: string };
  onClose: () => void;
  onConnect: (repo: string, taskPrefix: string) => Promise<void>;
}) {
  const repositories = useInstallationRepositories(workspaceId, installation.id);
  const [repo, setRepo] = useState('');
  const [prefix, setPrefix] = useState(DEFAULT_TASK_PREFIX);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await onConnect(repo, prefix.trim().toUpperCase());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Connect a repository from ${installation.accountLogin}`}
      description="Only repositories you gave the app access to on GitHub are listed."
      footer={
        <Button disabled={busy || !repo} onClick={() => void submit()}>
          Connect
        </Button>
      }
    >
      <div className="grid gap-4 p-5">
        <FormField id="github-app-repo" label="Repository">
          <Select value={repo} onValueChange={setRepo} disabled={!repositories.data?.length}>
            <SelectTrigger id="github-app-repo" aria-label="Repository">
              <SelectValue placeholder={repositories.isLoading ? 'Loading…' : repositories.data?.length ? 'Choose a repository' : 'No repositories: give the app access on GitHub'} />
            </SelectTrigger>
            <SelectContent>
              {repositories.data?.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {repositories.isError ? <p className="text-sm text-critical">{getErrorMessage(repositories.error)}</p> : null}
        <FormField id="github-app-prefix" label="Task prefix" hint={`Mention tasks in titles, descriptions or branch names as ${prefix || 'TF'}-42`}>
          <Input id="github-app-prefix" value={prefix} maxLength={10} onChange={(event) => setPrefix(event.target.value.toUpperCase())} />
        </FormField>
        <p className="text-xs text-muted-foreground">Tasks are moved as you, with your permissions. Change what opened, merged and closed pull requests do after connecting.</p>
      </div>
    </Modal>
  );
}

const OUTCOME_TONE = { ok: 'bg-good/10 text-good', ignored: 'bg-muted text-muted-foreground', error: 'bg-critical/10 text-critical' } as const;

/** What each delivery did, newest first; refreshes on its own while open. */
function SyncLog({ workspaceId, connection, onClose }: { workspaceId: string; connection: GithubConnectionResponse; onClose: () => void }) {
  const log = useGithubSyncLog(workspaceId, connection.id, true);
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={`${connection.repo}: sync log`} description="The latest deliveries from GitHub and what each one did. It updates by itself." size="lg">
      <div className="p-5">
        {log.data?.length === 0 ? <p className="text-sm text-muted-foreground">Nothing received yet.</p> : null}
        <ul aria-label="Deliveries" className="divide-y rounded-lg border text-sm">
          {log.data?.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-3 py-2">
              <span className={`mt-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10.5px] uppercase ${OUTCOME_TONE[entry.outcome as keyof typeof OUTCOME_TONE] ?? OUTCOME_TONE.ignored}`}>{entry.outcome}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate">{entry.detail}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.event}
                  {entry.prNumber ? ` · PR #${entry.prNumber}` : ''}
                  {entry.taskNumbers.length ? ` · tasks ${entry.taskNumbers.map((number) => `#${number}`).join(', ')}` : ''}
                </p>
              </div>
              <span className="text-xs whitespace-nowrap text-muted-foreground">{formatLongDate(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

/** Pull requests that mention no task: link one to a task by its number, or dismiss it. */
function PullRequestInbox({ workspaceId }: { workspaceId: string }) {
  const inbox = useGithubInbox(workspaceId, true);
  const mutations = useGithubInboxMutations(workspaceId);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const items = inbox.data ?? [];
  return (
    <section aria-labelledby="pr-inbox" className="grid gap-2 border-t pt-4">
      <h3 id="pr-inbox" className="flex items-center gap-2 text-sm font-semibold">
        <InboxIcon className="size-4 text-muted-foreground" /> Pull requests without a task
        {items.length ? <span className="rounded-full bg-muted px-1.5 text-xs font-normal">{items.length}</span> : null}
      </h3>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Every pull request mentions a task. Ones that don’t show up here to link by hand.</p> : null}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {items.map((item) => {
          const value = numbers[item.id] ?? '';
          const number = Number(value.replace(/^#/, ''));
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              <GitPullRequestIcon className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  #{item.number} {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.repo} · {item.author} · {item.state}
                </p>
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label={`Open pull request #${item.number} on GitHub`}>
                <ExternalLinkIcon className="size-4" />
              </a>
              <Input
                value={value}
                onChange={(event) => setNumbers({ ...numbers, [item.id]: event.target.value })}
                placeholder="Task #"
                inputMode="numeric"
                aria-label={`Task number for pull request #${item.number}`}
                className="h-8 w-24"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!Number.isInteger(number) || number < 1 || mutations.link.isPending}
                onClick={() => mutations.link.mutate({ itemId: item.id, taskNumber: number }, { onSuccess: () => toast.success(`Linked #${item.number} to task #${number}`) })}
              >
                <LinkIcon /> Link
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Dismiss pull request #${item.number}`} onClick={() => mutations.dismiss.mutate(item.id)}>
                <XIcon />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** How pull request events map onto linked tasks: GitHub → TaskFlow only (tasks never change GitHub). */
function SyncSettings({ sync, onChange }: { sync: GithubSyncSettings; onChange: (sync: GithubSyncSettings) => void }) {
  const rows: { key: 'onOpened' | 'onMerged' | 'onClosed'; label: string }[] = [
    { key: 'onOpened', label: 'Pull request opened' },
    { key: 'onMerged', label: 'Pull request merged' },
    { key: 'onClosed', label: 'Closed without merging' },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="ml-7 w-auto text-sm" aria-label="Status mapping">
      <thead>
        <tr className="text-left font-mono text-[10.5px] tracking-[0.06em] text-subtle-foreground uppercase">
          <th className="py-1 pr-3 font-semibold">GitHub</th>
          <th className="py-1 pr-3 font-semibold" aria-label="Direction" />
          <th className="py-1 font-semibold">Linked task</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="py-1 pr-3 text-muted-foreground">{row.label}</td>
            <td className="py-1 pr-3 text-muted-foreground">
              <ArrowRightIcon className="size-3.5" aria-label="sets" />
            </td>
            <td className="py-1">
              <Select value={sync[row.key] ?? NONE} onValueChange={(next) => onChange({ ...sync, [row.key]: next === NONE ? null : (next as StatusCategory) })}>
                <SelectTrigger className="h-8 w-48" aria-label={`When: ${row.label}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Leave the task</SelectItem>
                  {STATUS_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      Move to “{CATEGORY_LABELS[category]}”
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} className="pt-1 text-xs text-muted-foreground">
            One way: GitHub events move tasks; changing a task never changes GitHub. Finished work isn’t reopened by a new pull request.
          </td>
        </tr>
      </tfoot>
      </table>
    </div>
  );
}

function ConnectDialog({ onClose, onConnect }: { onClose: () => void; onConnect: (repo: string, prefix: string, sync: GithubSyncSettings) => Promise<void> }) {
  const [repo, setRepo] = useState('');
  const [prefix, setPrefix] = useState(DEFAULT_TASK_PREFIX);
  const [sync, setSync] = useState<GithubSyncSettings>(DEFAULT_GITHUB_SYNC);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await onConnect(repo.trim(), prefix.trim().toUpperCase(), sync);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title="Connect a GitHub repository"
      description="Pull requests that mention a task by its number link to it, and can move it along."
      footer={
        <Button disabled={busy || !repo.trim()} onClick={() => void submit()}>
          Connect
        </Button>
      }
    >
      <div className="grid gap-4 p-5">
        <FormField id="github-repo" label="Repository" hint="owner/name, as in the GitHub URL">
          <Input id="github-repo" value={repo} maxLength={201} placeholder="acme/web" onChange={(event) => setRepo(event.target.value)} />
        </FormField>
        <FormField id="github-prefix" label="Task prefix" hint={`Mention tasks in titles, descriptions or branch names as ${prefix || 'TF'}-42`}>
          <Input id="github-prefix" value={prefix} maxLength={10} onChange={(event) => setPrefix(event.target.value.toUpperCase())} />
        </FormField>
        <SyncSettings sync={sync} onChange={setSync} />
        <p className="text-xs text-muted-foreground">Tasks are moved as you, with your permissions. Use automations for anything more, like notifying the team when a PR merges.</p>
      </div>
    </Modal>
  );
}

function SecretDialog({ secret, onClose }: { secret: Secret; onClose: () => void }) {
  const copy = (value: string) => void navigator.clipboard.writeText(value).then(() => toast.success('Copied'));
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={`Add the webhook to ${secret.repo}`} description="The secret is shown only now. If you lose it, make a new one." size="lg">
      <ol className="grid list-decimal gap-4 p-5 pl-10 text-sm">
        <li>
          In GitHub, open <span className="font-medium">{secret.repo}</span> → Settings → Webhooks → Add webhook.
        </li>
        <li className="grid gap-1.5">
          Payload URL
          <CopyField value={secret.url} onCopy={copy} />
        </li>
        <li>
          Content type: <span className="font-mono">application/json</span>
        </li>
        <li className="grid gap-1.5">
          Secret
          <CopyField value={secret.secret} onCopy={copy} />
        </li>
        <li>Events: choose “Let me select individual events” and tick “Pull requests”. Save; GitHub sends a ping you’ll see here.</li>
      </ol>
    </Modal>
  );
}

function CopyField({ value, onCopy }: { value: string; onCopy: (value: string) => void }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" onFocus={(event) => event.target.select()} />
      <Button variant="outline" size="icon" aria-label="Copy" onClick={() => onCopy(value)}>
        <CopyIcon />
      </Button>
    </div>
  );
}
