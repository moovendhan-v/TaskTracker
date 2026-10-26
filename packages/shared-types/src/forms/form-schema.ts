/**
 * Validation rules for a form, published by the API from the same DTOs it
 * validates requests with. Clients check input with them before submitting,
 * so there is one set of rules and the server stays the authority.
 */

export const FORM_RULE_KINDS = [
  'required',
  'minLength',
  'maxLength',
  'min',
  'max',
  'integer',
  'number',
  'email',
  'uuid',
  'url',
  'pattern',
  'oneOf',
  'date',
  'datetime',
  'color',
  'boolean',
  'maxItems',
  'minItems',
  /** The value must be on or after another field's value (dates). */
  'onOrAfter',
  /** The value must be at most `value` days after another field's value. */
  'withinDays',
  /** The value must equal another field's value (password confirmation). */
  'sameAs',
] as const;
export type FormRuleKind = (typeof FORM_RULE_KINDS)[number];

export interface FormRule {
  kind: FormRuleKind;
  /** The limit for length, size, min/max and day rules; the pattern source for `pattern`. */
  value?: string | null;
  /** Allowed values for `oneOf`; flags for `pattern`. */
  values?: string[] | null;
  /** The other field for cross-field rules. */
  field?: string | null;
  /** What to show the user when the rule fails. */
  message: string;
}

export const FORM_FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'datetime', 'enum', 'list', 'object'] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface FormFieldSchema {
  name: string;
  label?: string | null;
  type: FormFieldType;
  /** Must be present and not empty. */
  required: boolean;
  /** May be sent as null to clear it. */
  nullable: boolean;
  rules: FormRule[];
}

export interface FormSchema {
  name: string;
  fields: FormFieldSchema[];
}

/** A validation problem tied to one field, as both the client validator and the API report them. */
export interface FieldError {
  field: string;
  message: string;
}
