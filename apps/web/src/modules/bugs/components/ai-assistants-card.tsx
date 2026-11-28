import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BotIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { timeAgo } from '@/lib/relative-time';
import { extensionApi } from '../api/extension.api';

const copy = (text: string, what: string) => void navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`));

function Snippet({ label, text }: { label: string; text: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => copy(text, label)}>
          <CopyIcon className="mr-1 size-3" /> Copy
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap break-all">{text}</pre>
    </div>
  );
}

/**
 * Security → AI assistants (E6.5): tokens for MCP clients (Claude, Cursor, …) and UTCP clients.
 * They reach the whole TaskFlow API as tools, limited to what you may do, read-only or read and
 * write; their changes are marked as theirs and audited.
 */
export function AiAssistantsCard({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const key = [...queryKeys.workspace(workspaceId), 'api-tokens'];
  const tokens = useQuery({ queryKey: key, queryFn: () => extensionApi.list(workspaceId), select: (all) => all.filter((token) => token.client === 'mcp') });
  const [name, setName] = useState('');
  const [access, setAccess] = useState<'read' | 'write'>('read');
  const [days, setDays] = useState('90');
  const [issued, setIssued] = useState<string | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: () => extensionApi.createAgentToken(workspaceId, name, access === 'write', Number(days)),
    onSuccess: (created) => {
      setIssued(created.token);
      setName('');
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const revoke = useMutation({ mutationFn: (tokenId: string) => extensionApi.revoke(workspaceId, tokenId), onSuccess: refresh, onError: (error) => toast.error(getErrorMessage(error)) });

  const origin = window.location.origin;
  const token = issued ?? '<your token>';
  const mcpUrl = `${origin}/api/mcp`;

  return (
    <Card role="region" aria-label="AI assistants">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BotIcon className="size-4 text-muted-foreground" /> AI assistants (MCP and UTCP)
        </CardTitle>
        <CardDescription>
          Let Claude, Cursor or any MCP or UTCP client work in this workspace as you: find and file bugs, update tasks, write and run test cases. It gets every feature of the TaskFlow API automatically, can do only what your role allows, never deletes, and everything it does is marked “AI” in history and recorded in the audit log.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="agent-name">Token name</Label>
            <Input id="agent-name" maxLength={80} placeholder="e.g. Claude Code on my laptop" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="agent-access">Access</Label>
            <Select value={access} onValueChange={(value) => setAccess(value as 'read' | 'write')}>
              <SelectTrigger id="agent-access" aria-label="Access">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read only</SelectItem>
                <SelectItem value="write">Read and change</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="agent-days">Expires in</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="agent-days" aria-label="Expires in">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            Create token
          </Button>
        </form>

        {issued ? (
          <div className="grid gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3" role="status">
            <p className="text-sm font-medium">Copy your token now: it won’t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 rounded bg-background p-2 font-mono text-xs break-all" data-testid="agent-token">
                {issued}
              </code>
              <Button variant="outline" size="sm" onClick={() => copy(issued, 'Token')}>
                <CopyIcon className="mr-1 size-3.5" /> Copy
              </Button>
            </div>
          </div>
        ) : null}

        <Tabs defaultValue="claude">
          <TabsList>
            <TabsTrigger value="claude">Claude Code</TabsTrigger>
            <TabsTrigger value="mcp">Other MCP clients</TabsTrigger>
            <TabsTrigger value="utcp">UTCP</TabsTrigger>
          </TabsList>
          <TabsContent value="claude" className="mt-2">
            <Snippet label="Run in a terminal" text={`claude mcp add --transport http taskflow ${mcpUrl} --header "Authorization: Bearer ${token}"`} />
          </TabsContent>
          <TabsContent value="mcp" className="mt-2 grid gap-2">
            <p className="text-xs text-muted-foreground">Streamable HTTP at {mcpUrl}, with the token as a Bearer header. For clients configured with JSON (Cursor, VS Code and others):</p>
            <Snippet label="MCP configuration" text={JSON.stringify({ mcpServers: { taskflow: { url: mcpUrl, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)} />
          </TabsContent>
          <TabsContent value="utcp" className="mt-2 grid gap-2">
            <p className="text-xs text-muted-foreground">The same tools as a UTCP 1.0 manual. Set TASKFLOW_TOKEN to your token in the client’s variables.</p>
            <Snippet
              label="UTCP manual call template"
              text={JSON.stringify({ name: 'taskflow', call_template_type: 'http', url: `${origin}/api/utcp`, http_method: 'GET', auth: { auth_type: 'api_key', api_key: 'Bearer ${TASKFLOW_TOKEN}', var_name: 'Authorization', location: 'header' } }, null, 2)}
            />
          </TabsContent>
        </Tabs>

        {tokens.data?.length ? (
          <ul aria-label="AI assistant tokens" className="divide-y rounded-lg border">
            {tokens.data.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.scopes.includes('write') ? 'Read and change' : 'Read only'} · {item.prefix ?? ''}… · {item.lastUsedAt ? `used ${timeAgo(item.lastUsedAt)}` : 'not used yet'} · expires {new Date(item.expiresAt).toLocaleDateString()}
                  </span>
                </span>
                <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(item.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No AI assistant has a token for this workspace.</p>
        )}
      </CardContent>
    </Card>
  );
}
