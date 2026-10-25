import { CUSTOM_FIELD_LIMITS, type CustomFieldValues } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { CustomField } from './custom-field.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

type Value = CustomFieldValues[string];

/**
 * Checks one value against its field's type and returns it in stored form.
 * Every type has one accepted shape, so filters and reports can rely on it.
 */
export function normalizeValue(field: CustomField, value: Value): Value {
  const invalid = (what: string) => DomainError.invalid(`${field.name}: ${what}`);
  switch (field.type) {
    case 'text':
      if (typeof value !== 'string' || value.length > CUSTOM_FIELD_LIMITS.textMax) throw invalid(`use text up to ${CUSTOM_FIELD_LIMITS.textMax} characters`);
      return value;
    case 'number':
    case 'money':
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e12) throw invalid('use a number');
      return field.type === 'money' ? Math.round(value * 100) / 100 : value;
    case 'date':
      if (typeof value !== 'string' || !DATE.test(value) || !new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)) throw invalid('use a date (yyyy-mm-dd)');
      return value;
    case 'checkbox':
      if (typeof value !== 'boolean') throw invalid('use true or false');
      return value;
    case 'url':
      if (typeof value !== 'string' || value.length > 2000 || !/^https?:\/\/[^\s]+$/i.test(value)) throw invalid('use a full https:// link');
      return value;
    case 'email':
      if (typeof value !== 'string' || value.length > 254 || !EMAIL.test(value)) throw invalid('use an email address');
      return value;
    case 'user':
      if (typeof value !== 'string' || !USER_ID.test(value)) throw invalid('choose a member');
      return value;
    case 'select':
      if (typeof value !== 'string' || !field.options.some((option) => option.id === value)) throw invalid('choose one of its options');
      return value;
    case 'multi_select': {
      if (!Array.isArray(value) || value.length > CUSTOM_FIELD_LIMITS.optionsMax) throw invalid('choose some of its options');
      const ids = [...new Set(value)];
      if (!ids.every((id) => typeof id === 'string' && field.options.some((option) => option.id === id))) throw invalid('choose some of its options');
      return ids;
    }
  }
}
