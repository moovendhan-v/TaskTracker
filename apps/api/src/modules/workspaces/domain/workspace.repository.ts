import type { TwoStepRequirement } from '@taskflow/shared-types';
import type { NewWorkspace, Workspace } from './workspace.js';

export abstract class WorkspaceRepository {
  abstract findById(id: string): Promise<Workspace | null>;
  abstract findByIds(ids: readonly string[]): Promise<Workspace[]>;
  abstract create(workspace: NewWorkspace): Promise<Workspace>;
  abstract save(workspace: Workspace): Promise<Workspace>;
  abstract delete(id: string): Promise<void>;
  abstract getTwoStep(id: string): Promise<TwoStepRequirement>;
  abstract setTwoStep(id: string, requirement: TwoStepRequirement): Promise<void>;
  /** The two-step rule of the organization the workspace is in (A3), if any. */
  abstract organizationTwoStep(id: string): Promise<{ name: string; require: TwoStepRequirement } | null>;
}
