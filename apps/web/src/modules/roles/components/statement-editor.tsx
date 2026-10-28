import { PlusIcon, TrashIcon } from 'lucide-react';
import { isSpaceScoped, matchesPattern, PERMISSIONS, type PolicyStatement } from '@taskflow/shared-types';
import { EntityIcon } from '@/components/common/entity-icon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { useSpaces } from '@/modules/spaces';
import { useProtectedFields } from '../hooks/use-policies';
import { PERMISSION_GROUPS } from '../lib/permission-groups';

type Where = 'workspace' | 'spaces' | 'notSpaces';

// An empty list still counts: it means "limited, but no space picked yet", which statementProblem reports.
const whereOf = (statement: PolicyStatement): Where => (Array.isArray(statement.spaces) ? 'spaces' : Array.isArray(statement.notSpaces) ? 'notSpaces' : 'workspace');

/** Why a statement can't be saved yet, or null. An empty space list would otherwise widen a deny to the whole workspace. */
export function statementProblem(statement: PolicyStatement): string | null {
  if (!statement.permissions?.length && !statement.fields?.length) return 'Every statement needs at least one permission or field.';
  if (whereOf(statement) === 'spaces' && !statement.spaces?.length) return 'Pick the spaces a limited deny applies in.';
  return null;
}

interface StatementEditorProps {
  workspaceId: string;
  statements: PolicyStatement[];
  onChange: (statements: PolicyStatement[]) => void;
  readOnly?: boolean;
}

/**
 * Edits a policy's statements like an IAM policy: each one allows or denies
 * permissions and fields, and a deny can be limited to some spaces (or to
 * every space except some). Deny always wins.
 */
export function StatementEditor({ workspaceId, statements, onChange, readOnly = false }: StatementEditorProps) {
  const update = (index: number, next: PolicyStatement) => onChange(statements.map((statement, at) => (at === index ? next : statement)));
  return (
    <div className="grid gap-3">
      {statements.map((statement, index) => (
        <StatementCard
          key={index}
          index={index}
          workspaceId={workspaceId}
          statement={statement}
          readOnly={readOnly}
          onChange={(next) => update(index, next)}
          onRemove={() => onChange(statements.filter((_, at) => at !== index))}
        />
      ))}
      {statements.length === 0 ? <p className="text-sm text-muted-foreground">No statements yet.</p> : null}
      {!readOnly ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...statements, { effect: 'allow', permissions: [] }])}>
            <PlusIcon /> Allow statement
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...statements, { effect: 'deny', permissions: [] }])}>
            <PlusIcon /> Deny statement
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface StatementCardProps {
  index: number;
  workspaceId: string;
  statement: PolicyStatement;
  readOnly: boolean;
  onChange: (statement: PolicyStatement) => void;
  onRemove: () => void;
}

function StatementCard({ index, workspaceId, statement, readOnly, onChange, onRemove }: StatementCardProps) {
  const { data: spaces = [] } = useSpaces(workspaceId);
  const { data: fields = [] } = useProtectedFields(workspaceId);
  const where = whereOf(statement);
  const limited = where !== 'workspace';
  const patterns = statement.permissions ?? [];
  const covered = (key: string) => patterns.some((pattern) => matchesPattern(pattern, key));
  const everything = patterns.includes('*');

  const togglePermission = (key: string, on: boolean) => {
    // Expand a wildcard into its keys before removing one of them.
    const expanded = patterns.flatMap((pattern) => (pattern.includes('*') ? PERMISSIONS.filter((permission) => matchesPattern(pattern, permission)) : [pattern]));
    onChange({ ...statement, permissions: on ? [...new Set([...expanded, key])] : expanded.filter((item) => item !== key) });
  };
  const toggleField = (key: string, on: boolean) => {
    const current = statement.fields ?? [];
    onChange({ ...statement, fields: on ? [...new Set([...current, key])] : current.filter((item) => item !== key && item !== '*') });
  };
  const setWhere = (next: Where) => {
    const ids = statement.spaces ?? statement.notSpaces ?? [];
    onChange({
      ...statement,
      spaces: next === 'spaces' ? ids : null,
      notSpaces: next === 'notSpaces' ? ids : null,
      fields: next === 'workspace' ? statement.fields : null,
    });
  };
  const toggleSpace = (spaceId: string, on: boolean) => {
    const key = where === 'notSpaces' ? 'notSpaces' : 'spaces';
    const current = statement[key] ?? [];
    onChange({ ...statement, [key]: on ? [...current, spaceId] : current.filter((id) => id !== spaceId) });
  };
  const chosenSpaces = new Set(statement.spaces ?? statement.notSpaces ?? []);

  return (
    <fieldset className={cn('grid gap-3 rounded-lg border p-3', statement.effect === 'deny' ? 'border-destructive/40 bg-destructive/5' : 'bg-card')} disabled={readOnly}>
      <legend className="sr-only">Statement {index + 1}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statement.effect} onValueChange={(effect: 'allow' | 'deny') => onChange({ ...statement, effect, ...(effect === 'allow' ? { spaces: null, notSpaces: null } : {}) })}>
          <SelectTrigger className="h-8 w-28" aria-label={`Statement ${index + 1} effect`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="allow">Allow</SelectItem>
            <SelectItem value="deny">Deny</SelectItem>
          </SelectContent>
        </Select>
        {statement.effect === 'deny' ? (
          <Select value={where} onValueChange={(value: Where) => setWhere(value)}>
            <SelectTrigger className="h-8 w-56" aria-label={`Where statement ${index + 1} applies`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspace">Across the workspace</SelectItem>
              <SelectItem value="spaces">Only in these spaces</SelectItem>
              <SelectItem value="notSpaces">In every space except</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">Across the workspace</span>
        )}
        <span className="flex-1" />
        {!readOnly ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove statement ${index + 1}`} onClick={onRemove}>
            <TrashIcon />
          </Button>
        ) : null}
      </div>

      {limited ? (
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{where === 'spaces' ? 'Spaces this deny applies in' : 'Spaces left alone'}</span>
          <div className="flex flex-wrap gap-1.5">
            {spaces.map((space) => {
              const on = chosenSpaces.has(space.id);
              return (
                <button
                  key={space.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSpace(space.id, !on)}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', on ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted')}
                >
                  <EntityIcon variant="badge" icon={space.icon} color={space.color} fallback={{ letter: space.name }} className="size-4 text-[9px] [&_svg]:size-3" />
                  {space.name}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Denying “View tasks” in a space hides it completely: its lists, tasks and sprints aren’t returned at all.</p>
        </div>
      ) : null}

      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={everything} onCheckedChange={(checked) => onChange({ ...statement, permissions: checked === true ? ['*'] : [] })} />
          {limited ? 'Everything that applies in a space' : 'Every permission'}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERMISSION_GROUPS.map((group) => {
            const items = group.permissions.filter((permission) => !limited || isSpaceScoped(permission.key));
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="grid content-start gap-1">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</span>
                {items.map((permission) => (
                  <label key={permission.key} className="flex items-start gap-2 text-sm">
                    <Checkbox className="mt-0.5" checked={covered(permission.key)} disabled={everything} onCheckedChange={(checked) => togglePermission(permission.key, checked === true)} />
                    <span>
                      {permission.label}
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground">{permission.key}</span>
                    </span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {!limited && fields.length > 0 ? (
        <div className="grid gap-1">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Fields</span>
          {fields.map((field) => (
            <label key={field.key} className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={(statement.fields ?? []).some((pattern) => matchesPattern(pattern, field.key))}
                onCheckedChange={(checked) => toggleField(field.key, checked === true)}
              />
              <span>
                {field.label}
                <span className="block text-xs text-muted-foreground">
                  {field.description}
                  {field.visibleByDefault ? '' : ' · hidden unless allowed'}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
