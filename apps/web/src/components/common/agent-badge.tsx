import { BotIcon } from 'lucide-react';

/** Marks a change or comment an AI agent made for someone (E6.5), e.g. "AI · Claude Code". */
export function AgentBadge({ agent }: { agent: string | null | undefined }) {
  if (!agent) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-chart-2/15 px-1.5 py-0.5 align-middle text-[10px] font-medium text-chart-2" title={`Done by the AI agent “${agent}” on this person’s behalf`} data-testid="agent-badge">
      <BotIcon className="size-3" aria-hidden="true" /> AI · {agent}
    </span>
  );
}
