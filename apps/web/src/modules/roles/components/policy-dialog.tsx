import { useState } from 'react';
import { POLICY_LIMITS, type PolicyResponse, type PolicyStatement, type SavePolicyRequest } from '@taskflow/shared-types';
import { Modal } from '@/components/kit/modal';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { StatementEditor, statementProblem } from './statement-editor';

interface PolicyDialogProps {
  workspaceId: string;
  /** Null to create a policy; a managed policy opens read-only. */
  policy: PolicyResponse | null;
  onClose: () => void;
  onSave: (values: SavePolicyRequest) => Promise<unknown>;
}

/** Create, edit or read a policy: a named, reusable list of allow and deny statements. */
export function PolicyDialog({ workspaceId, policy, onClose, onSave }: PolicyDialogProps) {
  const readOnly = Boolean(policy?.managed);
  const [name, setName] = useState(policy?.name ?? '');
  const [description, setDescription] = useState(policy?.description ?? '');
  const [statements, setStatements] = useState<PolicyStatement[]>(policy?.document.statements ?? [{ effect: 'deny', permissions: [] }]);
  const [saving, setSaving] = useState(false);
  const problem = statements.map(statementProblem).find(Boolean) ?? null;

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), document: { statements } });
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      tall
      title={policy ? (readOnly ? policy.name : `Edit ${policy.name}`) : 'New policy'}
      description={readOnly ? 'A managed policy. It updates with the app, so it can’t be edited; copy what you need into your own.' : 'Statements allow or deny permissions and fields. Deny always wins.'}
      footer={
        readOnly ? (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={saving || !name.trim() || statements.length === 0 || problem !== null} onClick={() => void save()}>
              {policy ? 'Save policy' : 'Create policy'}
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-4 p-5">
        {!readOnly ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="policy-name" label="Name">
              <Input id="policy-name" value={name} maxLength={POLICY_LIMITS.nameMax} placeholder="e.g. No access to Finance" onChange={(event) => setName(event.target.value)} />
            </FormField>
            <FormField id="policy-description" label="Description">
              <Textarea id="policy-description" rows={1} value={description} maxLength={POLICY_LIMITS.descriptionMax} onChange={(event) => setDescription(event.target.value)} />
            </FormField>
          </div>
        ) : (
          <p className="text-sm">{policy?.description}</p>
        )}
        <StatementEditor workspaceId={workspaceId} statements={statements} onChange={setStatements} readOnly={readOnly} />
        {problem && !readOnly ? <p className="text-xs text-destructive">{problem}</p> : null}
      </div>
    </Modal>
  );
}
