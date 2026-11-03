import type { FlowStep, FlowTraceOutcome } from '@taskflow/shared-types';
import { CheckIcon, GitBranchIcon, HourglassIcon, OctagonXIcon, PlusIcon, Trash2Icon, XIcon, ZapIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import type { FlowSlot } from '../lib/flow-edit';

interface CanvasProps {
  steps: FlowStep[];
  selectedId: string | null;
  describe: (step: FlowStep) => string;
  onSelect: (id: string) => void;
  onInsert: (slot: FlowSlot, kind: FlowStep['kind']) => void;
  onRemove: (id: string) => void;
  /** A run's path: the steps it reached and what happened there. */
  path?: ReadonlyMap<string, FlowTraceOutcome>;
}

/**
 * The flow, top to bottom (Features #7a, as a vertical canvas): steps are cards,
 * an if-step splits into Yes and No columns, and + between cards adds a step.
 * Keyboard: Tab through cards, Enter edits, Delete removes.
 */
export function FlowCanvas(props: CanvasProps) {
  return (
    <div role="tree" aria-label="Flow" className="grid justify-items-center gap-0">
      <StepList {...props} parentId={null} branch={null} />
    </div>
  );
}

function StepList({ steps, parentId, branch, ...props }: CanvasProps & { parentId: string | null; branch: 'yes' | 'no' | null }) {
  return (
    <div className="grid w-full justify-items-center">
      <Insert onInsert={(kind) => props.onInsert({ parentId, branch, index: 0 }, kind)} />
      {steps.map((step, index) => (
        <div key={step.id} className="grid w-full justify-items-center">
          <StepCard step={step} {...props} steps={steps} />
          <Insert onInsert={(kind) => props.onInsert({ parentId, branch, index: index + 1 }, kind)} />
        </div>
      ))}
    </div>
  );
}

const KIND: Record<FlowStep['kind'], { icon: typeof ZapIcon; tone: string; label: string }> = {
  action: { icon: ZapIcon, tone: 'bg-primary-soft text-ring', label: 'Then' },
  if: { icon: GitBranchIcon, tone: 'bg-violet-500/15 text-violet-600', label: 'If' },
  wait: { icon: HourglassIcon, tone: 'bg-amber-500/15 text-amber-600', label: 'Wait' },
  stop: { icon: OctagonXIcon, tone: 'bg-muted text-muted-foreground', label: 'Stop' },
};

const OUTCOME_LABEL: Record<FlowTraceOutcome, string> = { ran: 'Ran', 'took-yes': 'Yes', 'took-no': 'No', stopped: 'Stopped', failed: 'Failed', waited: 'Waited' };

function StepCard({ step, selectedId, describe, onSelect, onRemove, path, ...props }: CanvasProps & { step: FlowStep }) {
  const selected = step.id === selectedId;
  const outcome = path?.get(step.id);
  const Icon = KIND[step.kind].icon;
  const card = (
    <div
      role="treeitem"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect(step.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSelect(step.id);
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          onRemove(step.id);
        }
      }}
      className={cn(
        'group/step relative flex w-full max-w-sm cursor-pointer items-start gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        selected && 'border-ring ring-[3px] ring-primary-soft',
        path && !outcome && 'opacity-45',
        outcome === 'failed' && 'border-destructive',
      )}
    >
      <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md', KIND[step.kind].tone)}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-wide text-subtle-foreground uppercase">{KIND[step.kind].label}</span>
        <span className="block">{describe(step)}</span>
      </span>
      {outcome ? (
        <span className={cn('rounded-full px-1.5 py-0.5 font-mono text-[10.5px]', outcome === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-primary-soft text-ring')}>{OUTCOME_LABEL[outcome]}</span>
      ) : null}
      <button
        type="button"
        aria-label={`Remove step: ${describe(step)}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(step.id);
        }}
        className="hidden size-6 place-items-center rounded-md text-muted-foreground group-hover/step:grid group-focus-within/step:grid hover:text-destructive"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
  if (step.kind !== 'if') return card;
  return (
    <div className="grid w-full justify-items-center">
      {card}
      <div className="mt-1 grid w-full grid-cols-2 gap-3 rounded-xl border border-dashed p-2">
        {(['yes', 'no'] as const).map((branch) => (
          <section key={branch} aria-label={`${branch === 'yes' ? 'Yes' : 'No'} branch of: ${describe(step)}`} className="grid content-start justify-items-center">
            <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', branch === 'yes' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
              {branch === 'yes' ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />} {branch === 'yes' ? 'Yes' : 'No'}
            </span>
            <StepList {...props} steps={step[branch]} parentId={step.id} branch={branch} selectedId={selectedId} describe={describe} onSelect={onSelect} onRemove={onRemove} path={path} />
          </section>
        ))}
      </div>
    </div>
  );
}

function Insert({ onInsert }: { onInsert: (kind: FlowStep['kind']) => void }) {
  return (
    <div className="flex h-7 flex-col items-center">
      <span aria-hidden className="h-1.5 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Add a step here" className="grid size-5 place-items-center rounded-full border bg-background text-muted-foreground hover:border-ring hover:text-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <PlusIcon className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <DropdownMenuItem onSelect={() => onInsert('action')}>
            <ZapIcon /> Action
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onInsert('if')}>
            <GitBranchIcon /> If / else
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onInsert('wait')}>
            <HourglassIcon /> Wait
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onInsert('stop')}>
            <OctagonXIcon /> Stop
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span aria-hidden className="h-1.5 w-px bg-border" />
    </div>
  );
}
