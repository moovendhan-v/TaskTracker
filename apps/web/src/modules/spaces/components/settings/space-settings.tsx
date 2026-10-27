import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { NAME_MAX, type SpaceResponse } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EntityIcon } from '@/components/common/entity-icon';
import { IconGrid, type Appearance } from '@/components/common/icon-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { SaveAsTemplate } from '@/modules/templates';
import { usePermissions } from '@/modules/workspaces';
import { useSpaceMutations } from '../../hooks/use-spaces';
import { CustomFieldSettings } from './custom-field-settings';
import { StatusSettings } from './status-settings';

interface SpaceSettingsProps {
  workspaceId: string;
  space: SpaceResponse;
}

/** One project's settings: how it looks, the statuses its tasks move through, and its custom fields. */
export function SpaceSettings({ workspaceId, space }: SpaceSettingsProps) {
  const { canIn } = usePermissions(workspaceId);
  const canManage = canIn(space.id, 'space.manage');

  return (
    <div className="mx-auto grid max-w-3xl gap-6 pb-10">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>{canManage ? 'The name, icon and colour people see in the sidebar.' : 'Only people who manage spaces can change these.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <GeneralForm key={space.id} workspaceId={workspaceId} space={space} canManage={canManage} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Statuses</CardTitle>
          <CardDescription>
            The steps tasks move through, in board order. Each status has a meaning (not started, active, review, blocked, done, cancelled) that sprints, the backlog and
            overdue warnings use. Drag to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatusSettings workspaceId={workspaceId} spaceId={space.id} canManage={canManage} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Custom fields</CardTitle>
          <CardDescription>Extra information on this project’s tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomFieldSettings workspaceId={workspaceId} spaceId={space.id} canManage={canManage} />
        </CardContent>
      </Card>
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
            <CardDescription>Reuse this project’s statuses, fields, folders and lists for new projects, here or in another workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <SaveAsTemplate workspaceId={workspaceId} spaceId={space.id} spaceName={space.name} />
          </CardContent>
        </Card>
      ) : null}
      {canManage ? <DangerZone workspaceId={workspaceId} space={space} /> : null}
    </div>
  );
}

function GeneralForm({ workspaceId, space, canManage }: { workspaceId: string; space: SpaceResponse; canManage: boolean }) {
  const mutations = useSpaceMutations(workspaceId);
  const [name, setName] = useState(space.name);
  const [appearance, setAppearance] = useState<Appearance>({ icon: space.icon, color: space.color });
  const dirty = name.trim() !== space.name || appearance.icon !== space.icon || appearance.color !== space.color;

  const save = () =>
    mutations.update.mutate(
      { spaceId: space.id, body: { name: name.trim(), icon: appearance.icon, color: appearance.color ?? space.color } },
      { onSuccess: () => toast.success('Saved'), onError: (error) => toast.error(getErrorMessage(error)) },
    );

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_18rem]">
      <div className="grid content-start gap-3">
        <div className="flex items-center gap-3">
          <EntityIcon variant="badge" icon={appearance.icon} color={appearance.color} fallback={{ letter: name || space.name }} className="size-10 text-lg [&_svg]:size-6" />
          <Input value={name} disabled={!canManage} maxLength={NAME_MAX} aria-label="Project name" onChange={(event) => setName(event.target.value)} />
        </div>
        {canManage ? (
          <Button className="justify-self-start" size="sm" disabled={!dirty || !name.trim() || mutations.update.isPending} onClick={save}>
            Save changes
          </Button>
        ) : null}
      </div>
      {canManage ? <IconGrid value={appearance} colorOptional={false} onChange={setAppearance} /> : null}
    </div>
  );
}

function DangerZone({ workspaceId, space }: { workspaceId: string; space: SpaceResponse }) {
  const mutations = useSpaceMutations(workspaceId);
  const navigate = useNavigate();
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete project</CardTitle>
        <CardDescription>Deletes its folders, lists, tasks, sprints and statuses. Its docs stay in Docs. This can’t be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmDialog
          trigger={<Button variant="destructive">Delete {space.name}</Button>}
          title={`Delete ${space.name}?`}
          description="Everything in this project goes with it."
          confirmLabel="Delete project"
          onConfirm={() =>
            mutations.remove.mutateAsync(space.id).then(
              () => void navigate({ to: '/w/$workspaceId', params: { workspaceId } }),
              (error: unknown) => toast.error(getErrorMessage(error)),
            )
          }
        />
      </CardContent>
    </Card>
  );
}
