import { requireProvider } from '../runtime/decorator-runtime.js';
import { actorOf, changedEntityOf, type ChangeOptions } from '../runtime/change-target.js';
import { wrapMethod } from '../runtime/method-decorator.js';
import { domainEvent, type ChangeKind, type DomainEventFacts, type EntityType } from './domain-event.js';
import { EventBus } from './event-bus.port.js';

export interface AnnouncesOptions<R> extends ChangeOptions<R> {
  /** Facts for in-process handlers such as notification rules. Never sent to clients. */
  facts?: (result: R, ...args: never[]) => DomainEventFacts;
}

/**
 * Publishes a domain event after the method succeeds: live updates for clients,
 * cache invalidation, notifications and automations all hang off it. The method
 * takes the actor first and returns the changed entity.
 *
 *   @Announces('space.updated')
 */
export function Announces<R = never>(type: `${EntityType}.${ChangeKind}`, options: AnnouncesOptions<R> = {}): MethodDecorator {
  const [entityType, change] = type.split('.') as [EntityType, ChangeKind];
  return wrapMethod((original) =>
    async function announced(this: unknown, ...args: unknown[]) {
      const actor = actorOf(args, '@Announces');
      const result: unknown = await original.apply(this, args);
      const target = changedEntityOf(result, args, options as ChangeOptions<never>, '@Announces');
      if (!target.workspaceId) throw new Error(`@Announces(${type}) needs a workspace`);
      await requireProvider(EventBus, '@Announces').publish(
        domainEvent(entityType, change, {
          workspaceId: target.workspaceId,
          entityId: target.id,
          actorId: actor.userId,
          facts: options.facts?.(result as R, ...(args as never[])),
        }),
      );
      return result;
    },
  );
}
