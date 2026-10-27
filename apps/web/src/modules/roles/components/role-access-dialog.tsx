import { LockIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { SPACE_SCOPED_PERMISSIONS, type PolicyStatement, type RoleResponse, type SpaceRule } from '@taskflow/shared-types';
import { Modal } from '@/components/kit/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { useSpaces } from '@/modules/spaces';
import { usePolicies, usePolicyMutations } from '../hooks/use-policies';
import { StatementEditor, statementProblem } from './statement-editor';

interface RoleAccessDialogProps {
  workspaceId: string;
  role: RoleResponse;
  canManage: boolean;
  onClose: () => void;
}

/** A role's policies: the ones attached to it, its own inline statements, and the space limits they add up to. */
export function RoleAccessDialog({ workspaceId, role, canManage, onClose }: RoleAccessDialogProps) {
  const { data: policies = [] } = usePolicies(workspaceId);
  const mutations = usePolicyMutations(workspaceId);
  const [inline, setInline] = useState<PolicyStatement[]>(role.inlinePolicy.statements);
  const [toAttach, setToAttach] = useState('');
  const editable = canManage && role.systemKey !== 'owner';
  const attached = new Set(role.policies.map((policy) => policy.ref));
  const available = policies.filter((policy) => !attached.has(policy.id));
  const inlineChanged = JSON.stringify(inline) !== JSON.stringify(role.inlinePolicy.statements);
  const problem = inline.map(statementProblem).find(Boolean) ?? null;

  const saveInline = () =>
    mutations.setInline.mutate(
      { roleId: role.id, document: { statements: inline } },
      { onSuccess: () => toast.success('Saved'), onError: (error) => toast.error(getErrorMessage(error)) },
    );

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      tall
      title={`${role.name}: access`}
      description="Policies add up: anything allowed by one and denied by none. Deny always wins."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {editable ? (
            <Button disabled={!inlineChanged || problem !== null || mutations.setInline.isPending} onClick={saveInline}>
              Save inline statements
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-6 p-5">
        {role.systemKey === 'owner' ? (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <LockIcon className="size-4" /> The Owner role always has full access, so nobody can lock the owners out.
          </p>
        ) : null}

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Space limits</h3>
          <SpaceRuleSummary workspaceId={workspaceId} rules={role.spaceRules} />
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Attached policies</h3>
          <div className="flex flex-wrap gap-1.5">
            {role.policies.map((policy) => (
              <span key={policy.ref} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs">
                {policy.name}
                {policy.managed ? <span className="text-muted-foreground">· managed</span> : null}
                {editable ? (
                  <button type="button" aria-label={`Detach ${policy.name}`} className="rounded-full p-0.5 hover:bg-muted" onClick={() => mutations.detach.mutate({ roleId: role.id, policy: policy.ref })}>
                    <XIcon className="size-3" />
                  </button>
                ) : null}
              </span>
            ))}
            {role.policies.length === 0 ? <span className="text-sm text-muted-foreground">None</span> : null}
          </div>
          {editable && available.length > 0 ? (
            <div className="flex gap-2">
              <Select value={toAttach} onValueChange={setToAttach}>
                <SelectTrigger className="h-8 max-w-72" aria-label="Policy to attach">
                  <SelectValue placeholder="Choose a policy" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policy.name}
                      {policy.managed ? ' (managed)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!toAttach}
                onClick={() => mutations.attach.mutate({ roleId: role.id, policy: toAttach }, { onSuccess: () => setToAttach('') })}
              >
                <PlusIcon /> Attach
              </Button>
            </div>
          ) : null}
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Inline statements</h3>
          <p className="text-xs text-muted-foreground">Statements that belong to this role only, for one-off exceptions.</p>
          <StatementEditor workspaceId={workspaceId} statements={inline} onChange={setInline} readOnly={!editable} />
          {problem && editable && inlineChanged ? <p className="text-xs text-destructive">{problem}</p> : null}
        </section>
      </div>
    </Modal>
  );
}

/** Says, in words, where a role (or the current user) is limited. */
export function SpaceRuleSummary({ workspaceId, rules }: { workspaceId: string; rules: readonly SpaceRule[] }) {
  const { data: spaces = [] } = useSpaces(workspaceId);
  const nameOf = (id: string) => spaces.find((space) => space.id === id)?.name ?? 'a deleted space';
  if (rules.length === 0) return <p className="text-sm text-muted-foreground">No limits: the role’s permissions apply in every space.</p>;
  return (
    <ul className="grid gap-1.5">
      {rules.map((rule, index) => {
        const hides = rule.permissions.includes('task.view');
        return (
          <li key={index} className="flex flex-wrap items-center gap-1.5 text-sm">
            <Badge variant={hides ? 'default' : 'muted'} className={hides ? 'bg-destructive text-destructive-foreground' : undefined}>
              {hides ? 'Hidden' : 'Limited'}
            </Badge>
            <span>
              {rule.spaces ? `In ${rule.spaces.map(nameOf).join(', ')}` : `Everywhere except ${(rule.notSpaces ?? []).map(nameOf).join(', ') || 'nowhere'}`}
              <span className="text-muted-foreground">
                {rule.permissions.length === SPACE_SCOPED_PERMISSIONS.length ? ': no access at all' : `: can’t use ${rule.permissions.join(', ')}`}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
