import { requireProvider } from '../runtime/decorator-runtime.js';
import { actorOf, changedEntityOf, type ChangeOptions } from '../runtime/change-target.js';
import { wrapMethod } from '../runtime/method-decorator.js';
import { AuditLogger } from './audit-logger.port.js';

export interface AuditedOptions<R> extends ChangeOptions<R> {
  /** Audit target type. Defaults to the part of the action before the dot. */
  targetType?: string;
  /** Extra facts for the entry. Never put secrets or full content here. */
  metadata?: (result: R, ...args: never[]) => Record<string, unknown>;
}

/**
 * Writes an audit log entry after the method succeeds, in the same transaction,
 * so the entry and the change commit or roll back together. The method takes the
 * actor first and returns the changed entity (a DTO with `id` and `workspaceId`).
 *
 *   @Audited('role.update', { metadata: (role) => ({ name: role.name }) })
 */
export function Audited<R = never>(action: string, options: AuditedOptions<R> = {}): MethodDecorator {
  const targetType = options.targetType ?? action.split('.')[0] ?? action;
  return wrapMethod((original) =>
    async function audited(this: unknown, ...args: unknown[]) {
      const actor = actorOf(args, '@Audited');
      const result: unknown = await original.apply(this, args);
      const target = changedEntityOf(result, args, options as ChangeOptions<never>, '@Audited');
      await requireProvider(AuditLogger, '@Audited').record(actor, {
        action,
        targetType,
        targetId: target.id,
        workspaceId: target.workspaceId,
        metadata: options.metadata?.(result as R, ...(args as never[])),
      });
      return result;
    },
  );
}
