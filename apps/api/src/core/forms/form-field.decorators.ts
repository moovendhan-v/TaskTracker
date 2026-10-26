import { IsOptional, registerDecorator, ValidateIf, type ValidationArguments, type ValidationOptions } from 'class-validator';

interface FieldFlags {
  optional?: boolean;
  nullable?: boolean;
  label?: string;
}

const flags = new WeakMap<object, Map<string, FieldFlags>>();

function setFlags(target: object, property: string, next: FieldFlags): void {
  let byProperty = flags.get(target.constructor);
  if (!byProperty) flags.set(target.constructor, (byProperty = new Map()));
  byProperty.set(property, { ...byProperty.get(property), ...next });
}

/** Flags recorded by the decorators below, which class-validator's own metadata can't express. */
export function fieldFlags(target: object, property: string): FieldFlags {
  let current: unknown = target;
  // Walk up the prototype chain so subclasses inherit their parents' flags.
  while (typeof current === 'function') {
    const found = flags.get(current)?.get(property);
    if (found) return found;
    current = Object.getPrototypeOf(current);
  }
  return {};
}

/**
 * For input fields that may be left out but never set to null. GraphQL lets a
 * client send null for any nullable field, and class-validator's @IsOptional()
 * would skip validation for it; this runs every validator unless the field is
 * missing.
 */
export const IsOmittable = (): PropertyDecorator => (target, property) => {
  ValidateIf((_, value) => value !== undefined)(target, property);
  setFlags(target, String(property), { optional: true, nullable: false });
};

/** For fields where null means "clear it": may be left out or null, otherwise fully validated. */
export const IsClearable = (): PropertyDecorator => (target, property) => {
  IsOptional()(target, property);
  ValidateIf((_, value) => value !== null)(target, property);
  setFlags(target, String(property), { optional: true, nullable: true });
};

/** For fields that must be sent but may be null, e.g. "no limit". */
export const IsNullable = (): PropertyDecorator => (target, property) => {
  ValidateIf((_, value) => value !== null)(target, property);
  setFlags(target, String(property), { optional: false, nullable: true });
};

/** The name forms and error messages use for the field. Defaults to the property name in words. */
export const Label = (label: string): PropertyDecorator => (target, property) => setFlags(target, String(property), { label });

function crossField(name: string, other: string, check: (value: unknown, otherValue: unknown, limit?: number) => boolean, limit: number | undefined, options?: ValidationOptions) {
  return (target: object, property: string | symbol) =>
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: String(property),
      constraints: limit === undefined ? [other] : [other, limit],
      options,
      validator: {
        validate: (value: unknown, args: ValidationArguments) => check(value, (args.object as Record<string, unknown>)[other], limit),
      },
    });
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Present and not just whitespace. Services trim names, so "  " would otherwise become an empty name. */
export const IsNotBlank = (options?: ValidationOptions): PropertyDecorator => (target, property) =>
  registerDecorator({
    name: 'isNotBlank',
    target: target.constructor,
    propertyName: String(property),
    options,
    validator: { validate: (value: unknown) => value !== undefined && value !== null && (typeof value !== 'string' || value.trim().length > 0) },
  });

/** A calendar date, yyyy-mm-dd, that exists (no 2026-02-30). */
export const IsCalendarDate = (options?: ValidationOptions): PropertyDecorator => (target, property) =>
  registerDecorator({
    name: 'isCalendarDate',
    target: target.constructor,
    propertyName: String(property),
    options,
    validator: {
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !CALENDAR_DATE.test(value)) return false;
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
      },
    },
  });

const time = (value: unknown) => (typeof value === 'string' ? Date.parse(value) : Number.NaN);

/** A date that must be on or after another field's date. Skipped while either is empty. */
export const OnOrAfter = (other: string, options?: ValidationOptions): PropertyDecorator =>
  crossField('onOrAfter', other, (value, otherValue) => !value || !otherValue || time(value) >= time(otherValue), undefined, options);

/** A date at most `days` days after another field's date. */
export const WithinDaysOf = (other: string, days: number, options?: ValidationOptions): PropertyDecorator =>
  crossField('withinDays', other, (value, otherValue) => !value || !otherValue || (time(value) - time(otherValue)) / 86_400_000 <= days, days, options);

/** Must equal another field, e.g. a password confirmation. */
export const SameAs = (other: string, options?: ValidationOptions): PropertyDecorator =>
  crossField('sameAs', other, (value, otherValue) => value === otherValue, undefined, options);
