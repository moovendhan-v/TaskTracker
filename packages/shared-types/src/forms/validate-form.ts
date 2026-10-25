import type { FieldError, FormFieldSchema, FormRule, FormSchema } from './form-schema.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

type Values = Record<string, unknown>;

/**
 * Checks values against a form schema the way the API does, and returns the
 * first problem per field. Empty optional fields are skipped. Fields not in
 * the schema are ignored (the API rejects them, but forms never send them).
 */
export function validateForm(schema: FormSchema, values: Values): FieldError[] {
  const errors: FieldError[] = [];
  for (const field of schema.fields) {
    const message = validateField(field, values[field.name], values);
    if (message) errors.push({ field: field.name, message });
  }
  return errors;
}

export function validateField(field: FormFieldSchema, value: unknown, values: Values = {}): string | null {
  if (isEmpty(value)) {
    if (!field.required) return null;
    return field.rules.find((rule) => rule.kind === 'required')?.message ?? 'This field is required';
  }
  for (const rule of field.rules) {
    if (rule.kind === 'required') continue;
    if (!passes(rule, value, values)) return rule.message;
  }
  return null;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
}

function passes(rule: FormRule, value: unknown, values: Values): boolean {
  const limit = Number(rule.value);
  const text = typeof value === 'string' ? value : String(value);
  switch (rule.kind) {
    case 'minLength':
      return text.length >= limit;
    case 'maxLength':
      return text.length <= limit;
    case 'min':
      return Number(value) >= limit;
    case 'max':
      return Number(value) <= limit;
    case 'integer':
      return Number.isInteger(Number(value));
    case 'number':
      return Number.isFinite(Number(value));
    case 'email':
      return EMAIL.test(text);
    case 'uuid':
      return UUID.test(text);
    case 'url':
      return /^https?:\/\/[^\s]+$/i.test(text);
    case 'pattern':
      return new RegExp(rule.value ?? '', (rule.values ?? []).join('')).test(text);
    case 'oneOf':
      return (rule.values ?? []).includes(text);
    case 'date': {
      // Rejects dates that don't exist, such as 2026-02-30, which Date.parse rolls over.
      const date = new Date(`${text}T00:00:00Z`);
      return DATE.test(text) && !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
    }
    case 'datetime':
      return !Number.isNaN(Date.parse(text));
    case 'color':
      return COLOR.test(text);
    case 'boolean':
      return typeof value === 'boolean';
    case 'maxItems':
      return Array.isArray(value) && value.length <= limit;
    case 'minItems':
      return Array.isArray(value) && value.length >= limit;
    case 'onOrAfter': {
      const other = rule.field ? values[rule.field] : undefined;
      return isEmpty(other) || Date.parse(text) >= Date.parse(String(other));
    }
    case 'withinDays': {
      const other = rule.field ? values[rule.field] : undefined;
      return isEmpty(other) || (Date.parse(text) - Date.parse(String(other))) / DAY_MS <= limit;
    }
    case 'sameAs':
      return rule.field ? value === values[rule.field] : true;
    case 'required':
      return true;
  }
}
