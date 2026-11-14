import { CUSTOM_FIELD_LIMITS, type CustomFieldResponse, type CustomFieldType } from '@taskflow/shared-types';

type Value = string | number | boolean | string[] | null;

/** Task fields that apply to a task in this space: workspace-wide ones and the space's own, in their order. */
export function fieldsForTask(fields: readonly CustomFieldResponse[], spaceId: string): CustomFieldResponse[] {
  return fields.filter((field) => field.entity === 'task' && (field.spaceId === null || field.spaceId === spaceId)).sort((a, b) => a.position - b.position);
}

/**
 * What someone typed, as the value to save: null to clear, or `{ error }` when it
 * doesn't fit the type (the server checks again). Same rules as the API.
 */
export function parseFieldInput(type: CustomFieldType, raw: string): { value: Value } | { error: string } {
  const text = raw.trim();
  if (text === '') return { value: null };
  switch (type) {
    case 'number':
    case 'money': {
      const number = Number(text.replace(/,/g, ''));
      if (!Number.isFinite(number) || Math.abs(number) > 1e12) return { error: 'Use a number' };
      return { value: type === 'money' ? Math.round(number * 100) / 100 : number };
    }
    case 'url':
      return /^https?:\/\/\S+$/i.test(text) && text.length <= 2000 ? { value: text } : { error: 'Use a full https:// link' };
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) && text.length <= 254 ? { value: text } : { error: 'Use an email address' };
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? { value: text } : { error: 'Use a date' };
    case 'text':
      return text.length <= CUSTOM_FIELD_LIMITS.textMax ? { value: raw } : { error: `At most ${CUSTOM_FIELD_LIMITS.textMax} characters` };
    default:
      return { error: 'Pick a value' };
  }
}

/** A stored value as the text an input starts with. */
export function fieldInputText(value: unknown): string {
  return value === null || value === undefined ? '' : typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}
