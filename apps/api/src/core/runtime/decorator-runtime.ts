import { type Abstract, Injectable, type OnModuleDestroy, type OnModuleInit, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

let moduleRef: ModuleRef | null = null;

/**
 * Lets method decorators (@Cached, @Audited, @Announces) reach Nest providers.
 * TypeScript decorators run when a class is defined, long before Nest builds
 * its container, so they look providers up here at call time instead.
 */
@Injectable()
export class DecoratorRuntime implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly ref: ModuleRef) {}

  onModuleInit(): void {
    moduleRef = this.ref;
  }

  onModuleDestroy(): void {
    if (moduleRef === this.ref) moduleRef = null;
  }
}

/** The provider for `token`, or null before the app has started (plain unit tests). */
export function lookupProvider<T>(token: Type<T> | Abstract<T>): T | null {
  return moduleRef?.get(token, { strict: false }) ?? null;
}

/** Like lookupProvider, but for decorators that must not be skipped silently, such as audit logging. */
export function requireProvider<T>(token: Type<T> | Abstract<T>, decorator: string): T {
  const provider = lookupProvider(token);
  if (!provider) throw new Error(`${decorator} needs the Nest application to be running`);
  return provider;
}
