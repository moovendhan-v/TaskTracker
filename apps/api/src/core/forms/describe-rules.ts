import { getMetadataStorage, type ValidationError } from 'class-validator';
import type { FormFieldType, FormRule, FormRuleKind } from '@taskflow/shared-types';
import { fieldFlags } from './form-field.decorators.js';

interface Metadata {
  type: string;
  name?: string;
  propertyName: string;
  constraints?: unknown[];
  message?: unknown;
  each?: boolean;
  constraintCls?: unknown;
}

const storage = getMetadataStorage();

/** class-validator's metadata for one class, with each rule's name resolved. */
export function validationMetadata(target: object): (Metadata & { ruleName: string | undefined })[] {
  return (storage.getTargetValidationMetadatas(target as never, '', true, false) as unknown as Metadata[]).map((meta) => ({
    ...meta,
    ruleName: meta.name ?? (meta.constraintCls ? storage.getTargetValidatorConstraints(meta.constraintCls as never)[0]?.name : undefined),
  }));
}

export function humanize(name: string): string {
  const spaced = name
    .replace(/Id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function labelOf(target: object, property: string): string {
  return fieldFlags(target, property).label ?? humanize(property);
}

/**
 * A rule a client can check, with a message a person can read. Returns null for
 * metadata that isn't a rule (type checks the field type covers, conditions).
 */
export function describeRule(meta: Metadata & { ruleName: string | undefined }, label: string): FormRule | null {
  const [first, second] = meta.constraints ?? [];
  const custom = typeof meta.message === 'string' ? meta.message : null;
  const rule = (kind: FormRuleKind, message: string, extra: Partial<FormRule> = {}): FormRule => ({ kind, message: custom ?? message, ...extra });
  const n = (value: unknown) => String(value);

  switch (meta.ruleName) {
    case 'isNotEmpty':
    case 'isNotBlank':
    case 'isDefined':
      return rule('required', `${label} is required`);
    case 'minLength':
      return rule('minLength', `Use at least ${n(first)} characters`, { value: n(first) });
    case 'maxLength':
      return rule('maxLength', `Use at most ${n(first)} characters`, { value: n(first) });
    case 'isLength':
      return rule('maxLength', `Use ${n(first)} to ${n(second)} characters`, { value: n(second) });
    case 'min':
      return rule('min', `${label} must be at least ${n(first)}`, { value: n(first) });
    case 'max':
      return rule('max', `${label} must be at most ${n(first)}`, { value: n(first) });
    case 'isInt':
      return rule('integer', `${label} must be a whole number`);
    case 'isNumber':
      return rule('number', `${label} must be a number`);
    case 'isEmail':
      return rule('email', 'Enter a valid email address');
    case 'isUuid':
      return rule('uuid', `${label} is not valid`);
    case 'isUrl':
      return rule('url', 'Enter a full URL starting with https://');
    case 'matches': {
      const pattern = first instanceof RegExp ? first : null;
      return pattern ? rule('pattern', `${label} is not in the right format`, { value: pattern.source, values: pattern.flags ? [pattern.flags] : null }) : null;
    }
    case 'isIn': {
      const values = Array.isArray(first) ? first.map(String) : [];
      return rule('oneOf', `Choose one of: ${values.join(', ')}`, { values });
    }
    case 'isCalendarDate':
      return rule('date', `${label} must be a date (yyyy-mm-dd)`);
    case 'isDateString':
    case 'isIso8601':
      return rule('datetime', `${label} must be a valid date`);
    case 'isHexColor':
      return rule('color', `${label} must be a colour like #0ea5e9`);
    case 'isBoolean':
      return rule('boolean', `${label} must be yes or no`);
    case 'arrayMaxSize':
      return rule('maxItems', `Choose at most ${n(first)}`, { value: n(first) });
    case 'arrayMinSize':
      return rule('minItems', `Choose at least ${n(first)}`, { value: n(first) });
    case 'onOrAfter':
      return rule('onOrAfter', `${label} must be on or after the ${humanize(n(first)).toLowerCase()}`, { field: n(first) });
    case 'withinDays':
      return rule('withinDays', `${label} can be at most ${n(second)} days after the ${humanize(n(first)).toLowerCase()}`, { field: n(first), value: n(second) });
    case 'sameAs':
      return rule('sameAs', `${label} doesn't match`, { field: n(first) });
    default:
      return null;
  }
}

/** The field type a client should use, inferred from its rules. */
export function fieldTypeOf(ruleNames: ReadonlySet<string | undefined>): FormFieldType {
  if (ruleNames.has('isIn')) return 'enum';
  if (ruleNames.has('isBoolean')) return 'boolean';
  if (ruleNames.has('isInt') || ruleNames.has('isNumber') || ruleNames.has('min') || ruleNames.has('max')) return 'number';
  if (ruleNames.has('isCalendarDate')) return 'date';
  if (ruleNames.has('isDateString') || ruleNames.has('isIso8601')) return 'datetime';
  if (ruleNames.has('isArray') || ruleNames.has('arrayMaxSize')) return 'list';
  return 'string';
}

/**
 * Friendly messages for a failed validation, one per field, with dotted paths
 * for nested inputs (`filter.and.0.value`). Uses the same wording as the form
 * schema, so a client shows the same text whether it caught the problem or the
 * server did.
 */
export function fieldErrors(errors: readonly ValidationError[], parent = ''): { field: string; message: string }[] {
  const result: { field: string; message: string }[] = [];
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      const target = error.target?.constructor;
      const label = target ? labelOf(target, error.property) : humanize(error.property);
      const metas = target ? validationMetadata(target).filter((meta) => meta.propertyName === error.property) : [];
      const [name, fallback] = Object.entries(error.constraints)[0] ?? ['', 'is not valid'];
      const meta = metas.find((candidate) => candidate.ruleName === name);
      const described = meta ? describeRule(meta, label) : null;
      const message = name === 'whitelistValidation' ? `${error.property} is not a known field` : (described?.message ?? `${label} ${fallback.replace(new RegExp(`^${error.property} `), '')}`);
      result.push({ field: path, message });
    }
    if (error.children?.length) result.push(...fieldErrors(error.children, path));
  }
  return result;
}
