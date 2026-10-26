import type { FormFieldSchema, FormSchema } from '@taskflow/shared-types';
import { describeRule, fieldTypeOf, labelOf, validationMetadata } from './describe-rules.js';
import { fieldFlags } from './form-field.decorators.js';

const forms = new Map<string, object>();

/**
 * Publishes an input class's validation rules as a named form schema, so
 * clients validate with exactly the rules the API enforces:
 *
 *   @FormSchema('task.create')
 *   @InputType()
 *   export class CreateTaskInput { ... }
 */
export function FormSchema(name: string): ClassDecorator {
  return (target) => {
    if (forms.has(name) && forms.get(name) !== target) throw new Error(`Form schema "${name}" is declared twice`);
    forms.set(name, target);
  };
}

export function formNames(): string[] {
  return [...forms.keys()].sort();
}

export function describeForm(name: string): FormSchema | null {
  const target = forms.get(name);
  return target ? buildFormSchema(name, target) : null;
}

export function buildFormSchema(name: string, target: object): FormSchema {
  const metas = validationMetadata(target);
  const properties = [...new Set(metas.map((meta) => meta.propertyName))];
  const fields: FormFieldSchema[] = properties.map((property) => {
    const own = metas.filter((meta) => meta.propertyName === property);
    const flags = fieldFlags(target, property);
    const isOptional = own.some((meta) => meta.ruleName === 'isOptional');
    const optional = flags.optional ?? isOptional;
    const label = labelOf(target, property);
    const described = own.flatMap((meta) => describeRule(meta, label) ?? []);
    const required = !optional;
    // "Required" comes first; the rest keep the order the server checks them in.
    const requiredRule = described.find((rule) => rule.kind === 'required') ?? { kind: 'required' as const, message: `${label} is required` };
    const rules = [...(required ? [requiredRule] : []), ...described.filter((rule) => rule.kind !== 'required')];
    return {
      name: property,
      label,
      type: fieldTypeOf(new Set(own.map((meta) => meta.ruleName))),
      required,
      nullable: flags.nullable ?? isOptional,
      rules,
    };
  });
  return { name, fields };
}
