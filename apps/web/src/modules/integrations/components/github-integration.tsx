import { CopyIcon, GitPullRequestIcon, KeyRoundIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
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
import { useGithubConnections, useGithubMutations } from '../hooks/use-integrations';

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
  const showSecret = (result: { webhookSecret: string; connection: GithubConnectionResponse }) =>
    setSecret({ url: `${window.location.origin}${result.connection.webhookPath}`, secret: result.webhookSecret, repo: result.connection.repo });

  if (!canManage) return <p className="text-sm text-muted-foreground">People with the integration.manage permission can connect GitHub.</p>;

  return (
    <div className="grid gap-3">
      {connections.data?.length === 0 ? <p className="text-sm text-muted-foreground">No repositories connected.</p> : null}
      <ul className="grid gap-2">
        {connections.data?.map((connection) => (
          <li key={connection.id} className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <GitPullRequestIcon className="mt-0.5 size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{connection.repo}</p>
                <p className="text-xs text-muted-foreground">
                  Tasks are mentioned as {connection.taskPrefix}-42 ·{' '}
                  {connection.lastDeliveryAt ? `last delivery ${formatLongDate(connection.lastDeliveryAt)}: ${connection.lastDeliveryStatus}` : 'nothing received yet'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => mutations.rotate.mutate(connection.id, { onSuccess: showSecret })}>
                <KeyRoundIcon /> New secret
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Disconnect ${connection.repo}`}>
                    <TrashIcon />
                  </Button>
                }
                title={`Disconnect ${connection.repo}?`}
                description="Deliveries stop being accepted and its pull request links are removed. Remove the webhook in GitHub too."
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
    </div>
  );
}

function SyncSettings({ sync, onChange }: { sync: GithubSyncSettings; onChange: (sync: GithubSyncSettings) => void }) {
  const select = (label: string, value: StatusCategory | null, set: (value: StatusCategory | null) => void) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value ?? NONE} onValueChange={(next) => set(next === NONE ? null : (next as StatusCategory))}>
        <SelectTrigger className="h-8 w-48" aria-label={label}>
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
    </label>
  );
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 pl-7">
      {select('When a PR opens', sync.onOpened, (onOpened) => onChange({ ...sync, onOpened }))}
      {select('When a PR merges', sync.onMerged, (onMerged) => onChange({ ...sync, onMerged }))}
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
