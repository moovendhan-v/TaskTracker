import { Field, ObjectType } from '@nestjs/graphql';
import type { FormFieldSchema, FormFieldType, FormRule, FormRuleKind, FormSchema } from '@taskflow/shared-types';

@ObjectType('FormRule')
export class FormRuleGql implements FormRule {
  @Field(() => String) kind: FormRuleKind;
  @Field(() => String, { nullable: true }) value?: string | null;
  @Field(() => [String], { nullable: true }) values?: string[] | null;
  @Field(() => String, { nullable: true }) field?: string | null;
  @Field() message: string;
}

@ObjectType('FormFieldSchema')
export class FormFieldSchemaGql implements FormFieldSchema {
  @Field() name: string;
  @Field(() => String, { nullable: true }) label?: string | null;
  @Field(() => String) type: FormFieldType;
  @Field() required: boolean;
  @Field() nullable: boolean;
  @Field(() => [FormRuleGql]) rules: FormRuleGql[];
}

@ObjectType('FormSchema', { description: 'Validation rules for a form, the same ones the API enforces' })
export class FormSchemaGql implements FormSchema {
  @Field() name: string;
  @Field(() => [FormFieldSchemaGql]) fields: FormFieldSchemaGql[];
}
