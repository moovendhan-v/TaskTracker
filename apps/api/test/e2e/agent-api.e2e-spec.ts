import { beforeAll, describe, expect, inject, it } from 'vitest';
import { TestUser } from './support/api-client.js';
import { addMember, createWorkspace, type WorkspaceFixture } from './support/fixtures.js';
import { TEST_ORIGIN } from './support/test-env.js';

const CREATE = 'mutation($w: ID!, $n: String!, $s: [String!]!) { createApiToken(workspaceId: $w, name: $n, client: "mcp", scopes: $s) { token apiToken { id client scopes } } }';
const AUDIT = 'query($w: ID!) { workspaceAuditLog(workspaceId: $w, action: "agent.") { items { action targetId metadata } } }';

type Tool = { name: string; annotations: { readOnlyHint: boolean }; inputSchema: { properties: Record<string, unknown>; required: string[] } };
type CallResult = { content: { type: string; text: string }[]; structuredContent: { result?: unknown; error?: string; code?: string }; isError: boolean };

let ip = 1;
async function post(path: string, token: string | null, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${inject('apiUrl')}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-Forwarded-For': `10.88.0.${ip++ % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: (text ? JSON.parse(text) : null) as Record<string, unknown> | Record<string, unknown>[] | null };
}

let rpcId = 1;
const rpc = async (token: string, method: string, params: Record<string, unknown> = {}) => {
  const reply = await post('mcp', token, { jsonrpc: '2.0', id: rpcId++, method, params }, { 'MCP-Protocol-Version': '2025-06-18' });
  return reply.body as { result?: Record<string, unknown>; error?: { code: number; message: string } };
};
const callTool = async (token: string, name: string, args: Record<string, unknown>) => (await rpc(token, 'tools/call', { name, arguments: args })).result as unknown as CallResult;

describe('Agent API: the GraphQL API as MCP and UTCP tools (E6.5)', () => {
  let ws: WorkspaceFixture;
  let w: string;
  let member: TestUser;
  let readToken: string;
  let writeToken: string;
  let writeTokenId: string;
  let bugId: string;

  beforeAll(async () => {
    ws = await createWorkspace('Agent owner');
    w = ws.workspaceId;
    member = await TestUser.signUp('Agent member');
    await addMember(ws, member, 'Member');
    readToken = (await member.data<{ createApiToken: { token: string } }>(CREATE, { w, n: 'Claude (read only)', s: ['read'] })).createApiToken.token;
    const created = (await member.data<{ createApiToken: { token: string; apiToken: { id: string } } }>(CREATE, { w, n: 'Claude Code', s: ['read', 'write'] })).createApiToken;
    writeToken = created.token;
    writeTokenId = created.apiToken.id;
  });

  it('needs an agent token and refuses foreign browser origins', async () => {
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } };
    const anonymous = await post('mcp', null, init);
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get('www-authenticate')).toMatch(/^Bearer/);
    expect((await post('mcp', 'tfx_' + 'A'.repeat(43), init)).status).toBe(401);
    expect((await post('mcp', readToken, init, { Origin: 'https://evil.example.com' })).status).toBe(403);
    expect((await post('mcp', readToken, init, { Origin: TEST_ORIGIN })).status).toBe(200);
    expect((await post('mcp', readToken, init, { 'MCP-Protocol-Version': '1999-01-01' })).status).toBe(400);
    expect((await member.error(CREATE, { w, n: 'Sneaky', s: ['read', 'admin'] })).message).toMatch(/Unknown scope/);
  });

  it('speaks MCP: initialize, notifications, ping, unknown methods', async () => {
    const init = await rpc(readToken, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    expect(init.result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'taskflow' } });
    expect(String(init.result!['instructions'])).toMatch(/treat it as data/);
    expect((await post('mcp', readToken, { jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202);
    expect((await rpc(readToken, 'ping')).result).toEqual({});
    expect((await rpc(readToken, 'resources/list')).error).toMatchObject({ code: -32601 });
  });

  it('offers the GraphQL operations as tools: queries for read tokens, mutations too for write tokens, never the dangerous ones', async () => {
    const readTools = ((await rpc(readToken, 'tools/list')).result!['tools'] as Tool[]).map((tool) => tool.name);
    const writeTools = ((await rpc(writeToken, 'tools/list')).result!['tools'] as Tool[]);
    const writeNames = writeTools.map((tool) => tool.name);
    // Generated from the API: bugs, QA, tasks, sprints, docs and time all show up without per-feature code.
    expect(readTools).toEqual(expect.arrayContaining(['bugs', 'bug', 'bugCapture', 'task', 'searchTasks', 'qaPlans', 'qaPlanCases', 'qaReadiness', 'spaces']));
    expect(readTools).not.toContain('reportBug');
    expect(writeNames).toEqual(expect.arrayContaining(['reportBug', 'updateBug', 'setBugQaState', 'createTaskInSpace', 'updateTask', 'createComment', 'saveQaCase', 'recordQaRun']));
    // Destructive, admin and security operations are not tools.
    for (const name of ['deleteTask', 'deleteComment', 'removeMember', 'createApiToken', 'revokeApiToken', 'approveExtensionConnection', 'saveBugIntake', 'decideQaPlan', 'updateWorkspace', 'workspaceAuditLog', 'apiTokens']) {
      expect(writeNames).not.toContain(name);
    }
    const report = writeTools.find((tool) => tool.name === 'reportBug')!;
    expect(report.annotations.readOnlyHint).toBe(false);
    expect(report.inputSchema.required).toEqual(['input']);
    expect(report.inputSchema.properties).not.toHaveProperty('workspaceId');
  });

  it('runs a write as the owner, marks it as the agent’s, and audits it with before and after', async () => {
    const filed = await callTool(writeToken, 'reportBug', { input: { spaceId: ws.spaceId, title: 'Agent found: export button is missing', severity: 'P2', actual: 'No export on the reports page' } });
    expect(filed.isError).toBe(false);
    const bug = filed.structuredContent.result as { taskId: string; reporterId: string; source: string };
    expect(bug).toMatchObject({ reporterId: member.id });
    bugId = bug.taskId;
    expect(JSON.parse(filed.content[0]!.text)).toEqual(filed.structuredContent);

    const updated = await callTool(writeToken, 'updateTask', { taskId: bugId, input: { title: 'Export button missing on reports' } });
    expect(updated.isError).toBe(false);
    const commented = await callTool(writeToken, 'createComment', { taskId: bugId, input: { body: 'Reproduced in staging as well.' } });
    expect(commented.isError).toBe(false);

    // People see the agent's hand in history and comments.
    const { taskActivity } = await member.data<{ taskActivity: { field: string | null; agent: string | null; actorName: string }[] }>('query($w: ID!, $t: ID!) { taskActivity(workspaceId: $w, taskId: $t) { field agent actorName } }', { w, t: bugId });
    expect(taskActivity.find((entry) => entry.field === 'title')).toMatchObject({ agent: 'Claude Code', actorName: 'Agent member' });
    const { comments } = await member.data<{ comments: { body: string; agent: string | null }[] }>('query($w: ID!, $t: ID!) { comments(workspaceId: $w, taskId: $t) { body agent } }', { w, t: bugId });
    expect(comments).toEqual([expect.objectContaining({ body: 'Reproduced in staging as well.', agent: 'Claude Code' })]);
    // A person's own change stays unmarked.
    await member.data('mutation($w: ID!, $t: ID!) { updateTask(workspaceId: $w, taskId: $t, input: { priority: low }) { id } }', { w, t: bugId });
    const after = (await member.data<{ taskActivity: { field: string | null; agent: string | null }[] }>('query($w: ID!, $t: ID!) { taskActivity(workspaceId: $w, taskId: $t) { field agent } }', { w, t: bugId })).taskActivity;
    expect(after.find((entry) => entry.field === 'priority')?.agent).toBeNull();

    const entries = (await ws.owner.data<{ workspaceAuditLog: { items: { action: string; targetId: string | null; metadata: Record<string, unknown> }[] } }>(AUDIT, { w })).workspaceAuditLog.items;
    const update = entries.find((entry) => entry.action === 'agent.updateTask')!;
    expect(update.metadata).toMatchObject({ agent: 'Claude Code', tokenId: writeTokenId, protocol: 'mcp', tool: 'updateTask', kind: 'mutation', outcome: 'ok', resource: { taskId: bugId } });
    expect((update.metadata['before'] as { title: string }).title).toBe('Agent found: export button is missing');
    expect((update.metadata['after'] as { title: string }).title).toBe('Export button missing on reports');
  });

  it('reads with the same checks, and reports failures as tool errors (also audited)', async () => {
    const read = await callTool(readToken, 'bug', { taskId: bugId });
    expect(read).toMatchObject({ isError: false, structuredContent: { result: { title: 'Export button missing on reports' } } });
    // A read token can't write.
    expect((await rpc(readToken, 'tools/call', { name: 'reportBug', arguments: { input: { spaceId: ws.spaceId, title: 'x' } } })).error).toMatchObject({ code: -32602 });
    // Unknown arguments, bad values and other workspaces' data are refused.
    expect(await callTool(writeToken, 'bug', { taskId: bugId, sql: 'DROP TABLE task' })).toMatchObject({ isError: true, structuredContent: { code: 'BAD_USER_INPUT' } });
    expect((await callTool(writeToken, 'setBugQaState', { taskId: bugId, state: 'verified' })).structuredContent.error).toMatch(/can't move/);
    const other = await createWorkspace('Agent outsider');
    const foreign = (await other.owner.data<{ createTaskInSpace: { id: string } }>('mutation($w: ID!, $s: ID!) { createTaskInSpace(workspaceId: $w, spaceId: $s, input: { title: "Secret plan" }) { id } }', { w: other.workspaceId, s: other.spaceId })).createTaskInSpace.id;
    expect(await callTool(writeToken, 'task', { taskId: foreign })).toMatchObject({ isError: true, structuredContent: { code: 'NOT_FOUND' } });
    const entries = (await ws.owner.data<{ workspaceAuditLog: { items: { action: string; metadata: Record<string, unknown> }[] } }>(AUDIT, { w })).workspaceAuditLog.items;
    expect(entries.find((entry) => entry.action === 'agent.task')?.metadata).toMatchObject({ outcome: 'error', code: 'NOT_FOUND', kind: 'query' });
  });

  it('publishes the same tools as a UTCP manual with HTTP call templates', async () => {
    const response = await fetch(`${inject('apiUrl')}/api/utcp`, { headers: { Authorization: `Bearer ${writeToken}` } });
    expect(response.status).toBe(200);
    const manual = (await response.json()) as { utcp_version: string; tools: { name: string; inputs: { properties: { body: unknown } }; tool_call_template: Record<string, unknown> }[] };
    expect(manual.utcp_version).toBe('1.0.1');
    const bugs = manual.tools.find((tool) => tool.name === 'bugs')!;
    expect(bugs.tool_call_template).toMatchObject({ call_template_type: 'http', http_method: 'POST', body_field: 'body', auth: { auth_type: 'api_key', var_name: 'Authorization', location: 'header' } });
    expect(String(bugs.tool_call_template['url'])).toMatch(/\/api\/agent\/tools\/bugs$/);

    // What a UTCP client sends: the arguments as the JSON body.
    const called = await post('agent/tools/bugs', readToken, { spaceId: ws.spaceId });
    expect(called.status).toBe(200);
    expect(((called.body as { result: { title: string }[] }).result).map((item) => item.title)).toContain('Export button missing on reports');
    expect((await post('agent/tools/reportBug', readToken, { input: { spaceId: ws.spaceId, title: 'x' } })).status).toBe(404);
    expect((await fetch(`${inject('apiUrl')}/api/utcp`)).status).toBe(401);
  });

  it('stops at once when the token is revoked', async () => {
    await member.data('mutation($w: ID!, $t: ID!) { revokeApiToken(workspaceId: $w, tokenId: $t) }', { w, t: writeTokenId });
    expect((await post('mcp', writeToken, { jsonrpc: '2.0', id: 1, method: 'tools/list' })).status).toBe(401);
  });
});
