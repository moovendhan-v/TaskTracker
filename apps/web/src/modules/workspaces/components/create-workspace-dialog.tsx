import { useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { toast } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { useCreateWorkspace } from '../hooks/use-workspace-mutations';
import { WorkspaceForm } from './workspace-form';

export function CreateWorkspaceDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const create = useCreateWorkspace();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>A workspace holds your team's spaces, docs and people.</DialogDescription>
        </DialogHeader>
        <WorkspaceForm
          submitLabel="Create workspace"
          busy={create.isPending}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: (workspace) => {
                setOpen(false);
                void navigate({ to: '/w/$workspaceId', params: { workspaceId: workspace.id } });
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
