import { useNavigate } from '@tanstack/react-router';
import { Logo } from '@/components/common/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { WorkspaceForm } from '../components/workspace-form';
import { useCreateWorkspace } from '../hooks/use-workspace-mutations';

export function OnboardingPage() {
  const navigate = useNavigate();
  const create = useCreateWorkspace();

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 p-6">
      <Logo />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set up your workspace</CardTitle>
          <CardDescription>You can invite your team and add more workspaces later.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceForm
            submitLabel="Create workspace"
            busy={create.isPending}
            onSubmit={(values) =>
              create.mutate(values, {
                onSuccess: (workspace) => void navigate({ to: '/w/$workspaceId', params: { workspaceId: workspace.id } }),
                onError: (error) => toast.error(getErrorMessage(error)),
              })
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
