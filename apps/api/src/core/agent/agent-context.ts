import { AsyncLocalStorage } from 'node:async_hooks';

/** An AI agent acting for a person through MCP: the connection's name and its token. */
export interface AgentIdentity {
  name: string;
  tokenId: string;
}

const storage = new AsyncLocalStorage<AgentIdentity>();

/**
 * Who is acting, when it isn't the person themselves (E6.5): work done inside `run` (an MCP tool
 * call) is marked as the agent's in task history and comments, so people can tell AI changes from
 * their own. Outside it, changes are human.
 */
export const AgentContext = {
  run<T>(agent: AgentIdentity, work: () => Promise<T>): Promise<T> {
    return storage.run(agent, work);
  },
  current(): AgentIdentity | null {
    return storage.getStore() ?? null;
  },
};
