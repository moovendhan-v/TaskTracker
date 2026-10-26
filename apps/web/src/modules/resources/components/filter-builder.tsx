import { FilterIcon, PlusIcon, XIcon } from 'lucide-react';
import { LIST_OPERATORS, NULLARY_OPERATORS, type FilterOperator, type ResourceFieldSchema, type ResourceSchema } from '@taskflow/shared-types';
import { Segmented } from '@/components/kit/segmented';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { blankCondition, OPERATOR_LABELS, type DraftCondition } from '../lib/filters';

const control = 'h-8 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface FilterBuilderProps {
  schema: Pick<ResourceSchema, 'fields' | 'logic' | 'limits'>;
  conditions: readonly DraftCondition[];
  logic: 'and' | 'or';
  onChange: (conditions: DraftCondition[], logic: 'and' | 'or') => void;
  /** Field names to leave out (e.g. ones the view already filters on). */
  exclude?: readonly string[];
}

/**
 * Builds filters from what the API publishes for a resource: only its
 * filterable fields, only the operators each accepts, its enum options as
 * choices, and "match any" only when the resource allows `or`.
 */
export function FilterBuilder({ schema, conditions, logic, onChange, exclude = [] }: FilterBuilderProps) {
  const fields = schema.fields.filter((field) => field.operators.length > 0 && !exclude.includes(field.name));
  const fieldOf = (name: string) => fields.find((field) => field.name === name);
  const set = (id: string, patch: Partial<DraftCondition>) => onChange(conditions.map((item) => (item.id === id ? { ...item, ...patch } : item)), logic);
  const active = conditions.filter((item) => item.value || NULLARY_OPERATORS.includes(item.op)).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(active > 0 && 'border-primary/60 bg-primary/10')}>
          <FilterIcon /> Filter{active > 0 ? ` · ${active}` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[34rem] max-w-[calc(100vw-2rem)] p-3" align="start">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="font-medium">Match</span>
          {schema.logic.includes('or') ? (
            <Segmented label="Match" value={logic} onChange={(value) => onChange([...conditions], value)} options={[{ value: 'and', label: 'All' }, { value: 'or', label: 'Any' }]} />
          ) : (
            <span className="text-muted-foreground">all conditions</span>
          )}
        </div>
        <div className="grid gap-2">
          {conditions.map((condition) => {
            const field = fieldOf(condition.field);
            if (!field) return null;
            return (
              <div key={condition.id} className="flex flex-wrap items-center gap-1.5">
                <select
                  aria-label="Field"
                  value={condition.field}
                  onChange={(event) => {
                    const next = fieldOf(event.target.value);
                    if (next) set(condition.id, { field: next.name, op: next.operators[0] ?? 'eq', value: '', key: '' });
                  }}
                  className={cn(control, 'w-36')}
                >
                  {fields.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {field.keyed ? <input aria-label="Key" placeholder="key" value={condition.key} onChange={(event) => set(condition.id, { key: event.target.value })} className={cn(control, 'w-24')} /> : null}
                <select aria-label="Operator" value={condition.op} onChange={(event) => set(condition.id, { op: event.target.value as FilterOperator })} className={cn(control, 'w-40')}>
                  {field.operators.map((op) => (
                    <option key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </option>
                  ))}
                </select>
                {NULLARY_OPERATORS.includes(condition.op) ? null : <ValueInput field={field} condition={condition} onChange={(value) => set(condition.id, { value })} />}
                <button type="button" aria-label="Remove condition" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onChange(conditions.filter((item) => item.id !== condition.id), logic)}>
                  <XIcon className="size-4" />
                </button>
              </div>
            );
          })}
          {conditions.length === 0 ? <p className="text-sm text-muted-foreground">No filters yet.</p> : null}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={!fields[0] || conditions.length >= schema.limits.maxConditions} onClick={() => fields[0] && onChange([...conditions, blankCondition(fields[0])], logic)}>
            <PlusIcon /> Add condition
          </Button>
          {conditions.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => onChange([], logic)}>
              Clear all
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ValueInput({ field, condition, onChange }: { field: ResourceFieldSchema; condition: DraftCondition; onChange: (value: string) => void }) {
  const multiple = LIST_OPERATORS.includes(condition.op);
  if (field.options?.length && !multiple) {
    return (
      <select aria-label="Value" value={condition.value} onChange={(event) => onChange(event.target.value)} className={cn(control, 'min-w-32 flex-1')}>
        <option value="">Choose…</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.options?.length && multiple) {
    const chosen = new Set(condition.value.split(',').filter(Boolean));
    return (
      <div className="flex min-w-32 flex-1 flex-wrap gap-1" role="group" aria-label="Values">
        {field.options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={chosen.has(option.value)}
            onClick={() => {
              if (chosen.has(option.value)) chosen.delete(option.value);
              else chosen.add(option.value);
              onChange([...chosen].join(','));
            }}
            className={cn('rounded-full border px-2 py-0.5 text-xs', chosen.has(option.value) ? 'border-primary/60 bg-primary/15' : 'hover:bg-muted')}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }
  const type = field.type === 'number' ? 'number' : field.type === 'date' || field.type === 'datetime' ? 'date' : 'text';
  return (
    <input
      aria-label="Value"
      type={multiple ? 'text' : type}
      value={condition.value}
      placeholder={multiple ? 'a, b, c' : field.type === 'user' ? '@me or a user id' : 'value'}
      onChange={(event) => onChange(event.target.value)}
      className={cn(control, 'min-w-32 flex-1')}
    />
  );
}
