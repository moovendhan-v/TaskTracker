import type { Actor } from '../http/types/authenticated-request.js';

/** What a changing method returns: the entity it changed, as a response DTO. */
export interface ChangedEntity {
  id: string;
  workspaceId?: string | null;
}

/** Options shared by decorators that describe a change from a method's arguments and result. */
export interface ChangeOptions<R = never> {
  /** Picks the workspace from the arguments when the result doesn't carry `workspaceId`. */
  workspace?: (...args: never[]) => string | null;
  /** Picks the changed entity from the result when it isn't the result itself. */
  entity?: (result: R) => ChangedEntity;
}

/** The acting user, which by convention is every changing service method's first argument. */
export function actorOf(args: readonly unknown[], decorator: string): Actor {
  const [actor] = args;
  if (!actor || typeof actor !== 'object' || typeof (actor as Actor).userId !== 'string') {
    throw new Error(`${decorator} expects the actor as the method's first argument`);
  }
  return actor as Actor;
}

export function changedEntityOf(result: unknown, args: readonly unknown[], options: ChangeOptions<never>, decorator: string): { id: string; workspaceId: string | null } {
  const entity = options.entity ? options.entity(result as never) : (result as ChangedEntity | null | undefined);
  if (!entity || typeof entity.id !== 'string') throw new Error(`${decorator} expects the method to return the changed entity`);
  const workspaceId = options.workspace ? options.workspace(...(args as never[])) : (entity.workspaceId ?? null);
  return { id: entity.id, workspaceId };
}

/** For `method(actor, workspaceId, ...)` whose result doesn't carry `workspaceId`. */
export const workspaceFromArg = { workspace: (_actor: unknown, workspaceId: string) => workspaceId };

/** For `method(actor, access, ...)` whose result doesn't carry `workspaceId`. */
export const workspaceFromAccess = { workspace: (_actor: unknown, access: { workspaceId: string }) => access.workspaceId };
