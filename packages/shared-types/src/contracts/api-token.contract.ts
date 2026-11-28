/**
 * E6.3 personal API tokens (the browser extension first, MCP next). A token acts as its owner in
 * one workspace, limited further to its scopes; the owner's permissions still apply on top.
 */
/** bugs:* for the browser extension; read / write for AI agents (MCP, UTCP) across the API. */
export const API_TOKEN_SCOPES = ['bugs:read', 'bugs:write', 'tasks:read', 'tasks:write', 'read', 'write'] as const;
export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];
export const API_TOKEN_CLIENTS = ['extension', 'mcp', 'script'] as const;
export type ApiTokenClient = (typeof API_TOKEN_CLIENTS)[number];

/** What the extension asks for: file reports and read them back (for the similar-report check). */
export const EXTENSION_SCOPES: readonly ApiTokenScope[] = ['bugs:read', 'bugs:write'];
/** What an AI agent token may do: read only, or read and change. */
export const AGENT_SCOPES: Record<'read' | 'write', readonly ApiTokenScope[]> = { read: ['read'], write: ['read', 'write'] };
/** Tokens expire; reconnecting is one click. */
export const API_TOKEN_DAYS = 90;
/** How long an approval waits for the extension to pick up its token. */
export const API_TOKEN_CHALLENGE_MINUTES = 10;
/** Shown in front of every token, so leaked ones are easy to spot (and to scan for). */
export const API_TOKEN_PREFIX = 'tfx_';

export interface ApiTokenResponse {
  id: string;
  name: string;
  client: ApiTokenClient;
  scopes: ApiTokenScope[];
  /** The token's first characters, to tell tokens apart; never the token. */
  prefix: string | null;
  /** True while approved but not yet picked up by the extension. */
  pending: boolean;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

/** The extension's view of its connection. */
export interface ExtensionSessionResponse {
  user: { name: string; email: string };
  workspace: { id: string; name: string };
  projects: { id: string; name: string }[];
  scopes: ApiTokenScope[];
  expiresAt: string;
}
