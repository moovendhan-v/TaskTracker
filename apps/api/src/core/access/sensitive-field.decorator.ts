import { Field, type FieldMiddleware, type FieldOptions, type ReturnTypeFunc } from '@nestjs/graphql';
import type { AuthenticatedRequest } from '../http/types/authenticated-request.js';

/**
 * Whether the caller of this request may read a protected field. In a
 * workspace, their policies decide; outside one, only super admins (platform
 * views) may. Anything else fails closed.
 */
export function canReadField(request: Partial<AuthenticatedRequest> | undefined, key: string): boolean {
  if (request?.workspaceAccess) return request.workspaceAccess.readableFields.has(key);
  return request?.user?.platformRole === 'SUPER_ADMIN';
}

function fieldAccess(key: string): FieldMiddleware {
  return async (context, next) => (canReadField((context.context as { req?: AuthenticatedRequest }).req, key) ? next() : null);
}

/**
 * A GraphQL field whose value only callers allowed by policy see; everyone else
 * gets null. The field is always nullable for that reason. Data stays the same
 * in caches; the decision happens per caller when the response is built.
 *
 *   @SensitiveField('member.email', () => String)
 *   email: string | null;
 */
export function SensitiveField(key: string, type: ReturnTypeFunc, options: Omit<FieldOptions, 'nullable'> = {}): PropertyDecorator {
  return Field(type, {
    ...options,
    nullable: true,
    description: [options.description, `Protected (${key}): null unless a policy lets the caller read it.`].filter(Boolean).join(' '),
    middleware: [...(options.middleware ?? []), fieldAccess(key)],
  });
}
