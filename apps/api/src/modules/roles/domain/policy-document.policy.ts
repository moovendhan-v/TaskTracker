import {
  POLICY_EFFECTS,
  POLICY_LIMITS,
  canReadField,
  expandPermissions,
  isKnownFieldPattern,
  isKnownPermissionPattern,
  matchesPattern,
  PROTECTED_FIELDS,
  type EffectiveAccess,
  type Permission,
  type PolicyDocument,
} from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import { OWNER_ONLY_PERMISSION } from './role-grant.policy.js';

/** Rules for policy documents: well-formed, and never a way to give anyone more than you have. */
export const PolicyDocumentPolicy = {
  /** Normalizes a document from input: known patterns only, within limits, no duplicates. */
  normalize(document: PolicyDocument): PolicyDocument {
    if (!document || !Array.isArray(document.statements)) throw DomainError.invalid('A policy needs a list of statements');
    if (document.statements.length > POLICY_LIMITS.maxStatements) throw DomainError.invalid(`Use at most ${POLICY_LIMITS.maxStatements} statements`);
    return {
      statements: document.statements.map((statement, index) => {
        const where = `Statement ${index + 1}`;
        if (!POLICY_EFFECTS.includes(statement.effect)) throw DomainError.invalid(`${where}: effect must be allow or deny`);
        const permissions = unique(statement.permissions ?? []);
        const fields = unique(statement.fields ?? []);
        if (permissions.length === 0 && fields.length === 0) throw DomainError.invalid(`${where} needs permissions or fields`);
        if (permissions.length > POLICY_LIMITS.maxEntriesPerStatement || fields.length > POLICY_LIMITS.maxEntriesPerStatement) {
          throw DomainError.invalid(`${where} has too many entries`);
        }
        const unknownPermission = permissions.find((pattern) => !isKnownPermissionPattern(pattern));
        if (unknownPermission) throw DomainError.invalid(`${where}: unknown permission ${unknownPermission.slice(0, 64)}`);
        const unknownField = fields.find((pattern) => !isKnownFieldPattern(pattern));
        if (unknownField) throw DomainError.invalid(`${where}: unknown field ${unknownField.slice(0, 64)}`);
        return { effect: statement.effect, ...(permissions.length ? { permissions } : {}), ...(fields.length ? { fields } : {}) };
      }),
    };
  },

  /**
   * Stops privilege escalation: a document may only allow permissions and fields
   * the actor already has. Denies only take rights away, so they are always fine.
   */
  assertCanGrant(actor: { permissions: ReadonlySet<Permission>; readableFields: ReadonlySet<string> }, document: PolicyDocument): void {
    const allows = document.statements.filter((statement) => statement.effect === 'allow');
    const permissions = expandPermissions(allows.flatMap((statement) => statement.permissions ?? []));
    if (permissions.includes(OWNER_ONLY_PERMISSION)) throw DomainError.invalid(`${OWNER_ONLY_PERMISSION} is reserved for the Owner role`);
    if (!permissions.every((permission) => actor.permissions.has(permission))) throw DomainError.forbidden('You cannot grant permissions you do not have');
    const fieldPatterns = allows.flatMap((statement) => statement.fields ?? []);
    const fields = PROTECTED_FIELDS.map((field) => field.key).filter((key) => fieldPatterns.some((pattern) => matchesPattern(pattern, key)));
    if (!fields.every((key) => actor.readableFields.has(key))) throw DomainError.forbidden('You cannot grant access to fields you cannot see');
  },

  /** Fields an effective access can read, as a set for quick checks. */
  readableFields(access: EffectiveAccess): string[] {
    return PROTECTED_FIELDS.map((field) => field.key).filter((key) => canReadField(access, key));
  },
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}
