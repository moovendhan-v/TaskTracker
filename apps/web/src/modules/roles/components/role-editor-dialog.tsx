import { useState, type ReactNode } from 'react';
import { ROLE_NAME_MAX, type Permission, type RoleResponse } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PERMISSION_GROUPS } from '../lib/permission-groups';

const OWNER_ONLY: Permission = 'workspace.manage';

interface RoleEditorDialogProps {
  trigger: ReactNode;
  role?: RoleResponse;
  /** Permissions the current user holds; they can't grant anything else. */
  grantable: ReadonlySet<Permission>;
  onSave: (values: { name: string; permissions: Permission[] }) => Promise<unknown>;
}

export function RoleEditorDialog({ trigger, role, grantable, onSave }: RoleEditorDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<Permission>>(new Set());
  const [saving, setSaving] = useState(false);
  const readOnly = Boolean(role?.systemKey);

  /** Opening the dialog starts from the saved values, so a cancelled edit leaves nothing behind. */
  function changeOpen(next: boolean) {
    if (next) {
      setName(role?.name ?? '');
      // Built-in roles get their rights from managed policies, so show what they add up to.
      setSelected(new Set(role ? (role.systemKey ? role.effectivePermissions : role.permissions) : ['task.view', 'doc.view']));
    }
    setOpen(next);
  }

  function toggle(permission: Permission, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({ name: name.trim(), permissions: [...selected] });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? role?.name : role ? 'Edit role' : 'New role'}</DialogTitle>
          <DialogDescription>
            {readOnly ? 'Built-in roles can’t be changed. Create a custom role for a different mix.' : 'Pick what people with this role can do.'}
          </DialogDescription>
        </DialogHeader>
        {readOnly ? null : (
          <FormField id="role-name" label="Role name">
            <Input id="role-name" value={name} maxLength={ROLE_NAME_MAX} onChange={(event) => setName(event.target.value)} placeholder="e.g. Contractor" />
          </FormField>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          {PERMISSION_GROUPS.map((group) => (
            <fieldset key={group.label} className="grid gap-2">
              <legend className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</legend>
              {group.permissions.map(({ key, label }) => {
                const disabled = readOnly || key === OWNER_ONLY || !grantable.has(key);
                return (
                  <label key={key} className="flex items-start gap-2 text-sm has-[button:disabled]:opacity-60">
                    <Checkbox
                      checked={selected.has(key)}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggle(key, checked === true)}
                      className="mt-0.5"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
        {readOnly ? null : (
          <DialogFooter>
            <Button onClick={() => void save()} disabled={saving || !name.trim()}>
              Save role
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
