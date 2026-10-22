import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { RoleResponse } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { useMemberMutations } from '../hooks/use-members';
import { RoleSelect } from './role-select';

const schema = z.object({ email: z.email('Enter a valid email').max(254), roleId: z.string().min(1, 'Choose a role') });
type Values = z.infer<typeof schema>;

export function AddMemberDialog({ workspaceId, roles }: { workspaceId: string; roles: RoleResponse[] }) {
  const [open, setOpen] = useState(false);
  const { add } = useMemberMutations(workspaceId);
  const defaultRole = roles.find((role) => role.systemKey === 'member')?.id ?? '';
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { email: '', roleId: defaultRole } });

  const submit = form.handleSubmit((values) =>
    add.mutate(values, {
      onSuccess: (result) => {
        toast.success(result.message);
        form.reset();
        setOpen(false);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlusIcon /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>They need a TaskFlow account already. You can only give roles with permissions you hold.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormField id="member-email" label="Email" error={form.formState.errors.email?.message}>
            <Input id="member-email" type="email" {...form.register('email')} />
          </FormField>
          <FormField id="member-role" label="Role" error={form.formState.errors.roleId?.message}>
            <Controller
              control={form.control}
              name="roleId"
              render={({ field }) => <RoleSelect id="member-role" roles={roles} value={field.value} onChange={field.onChange} />}
            />
          </FormField>
          <DialogFooter>
            <Button type="submit" disabled={add.isPending}>
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
