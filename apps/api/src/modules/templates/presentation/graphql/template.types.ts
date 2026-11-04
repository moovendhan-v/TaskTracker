import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsString, Matches, MaxLength } from 'class-validator';
import {
  COLOR_PATTERN,
  ICON_KEYS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LIMITS,
  type CreateFromTemplateRequest,
  type IconKey,
  type ImportTemplateRequest,
  type SaveAsTemplateRequest,
  type TemplateCategory,
  type TemplateContent,
  type TemplateResponse,
} from '@taskflow/shared-types';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { IconKeyEnum, TemplateCategoryEnum } from '../../../../core/graphql/enums.js';
import { JSONObjectScalar } from '../../../../core/graphql/json-object.scalar.js';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('TemplateCounts')
export class TemplateCountsGql {
  @Field(() => Int) statuses: number;
  @Field(() => Int) customFields: number;
  @Field(() => Int) folders: number;
  @Field(() => Int) lists: number;
  @Field(() => Int) tasks: number;
  @Field(() => Int) docs: number;
  @Field(() => Int) automations: number;
}

@ObjectType('ProjectTemplate')
export class TemplateGql implements TemplateResponse {
  @Field({ description: 'builtin:<key> for templates that ship with the app, otherwise a UUID' }) id: string;
  @Field() name: string;
  @Field() description: string;
  @Field(() => TemplateCategoryEnum) category: TemplateCategory;
  @Field() builtIn: boolean;
  @Field(() => IconKeyEnum, { nullable: true }) icon: IconKey | null;
  @Field() color: string;
  @Field(() => TemplateCountsGql) counts: TemplateCountsGql;
  @Field(() => JSONObjectScalar, { description: 'The template itself (TemplateContent); export it as JSON' }) content: TemplateContent;
  @Field(() => String, { nullable: true }) createdAt: string | null;
}

@FormSchema('template.apply')
@InputType()
export class CreateFromTemplateInput implements CreateFromTemplateRequest {
  @Field() @IsString() @IsNotBlank() @MaxLength(TEMPLATE_LIMITS.nameMax) name: string;
  @Field({ nullable: true }) @IsOmittable() @Matches(new RegExp(COLOR_PATTERN)) color?: string;
  @Field(() => IconKeyEnum, { nullable: true }) @IsClearable() @IsIn(ICON_KEYS) icon?: IconKey | null;
  @Field({ nullable: true, description: 'Starter tasks and docs (default true)' }) @IsOmittable() @IsBoolean() includeContent?: boolean;
}

@FormSchema('template.save')
@InputType()
export class SaveAsTemplateInput implements SaveAsTemplateRequest {
  @Field() @IsString() @IsNotBlank() @MaxLength(TEMPLATE_LIMITS.nameMax) name: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(TEMPLATE_LIMITS.descriptionMax) description?: string;
  @Field(() => TemplateCategoryEnum, { nullable: true }) @IsOmittable() @IsIn(TEMPLATE_CATEGORIES) category?: TemplateCategory;
  @Field({ nullable: true, description: 'Copy open tasks and docs too (default false)' }) @IsOmittable() @IsBoolean() includeContent?: boolean;
}

@FormSchema('template.import')
@InputType()
export class ImportTemplateInput implements ImportTemplateRequest {
  @Field() @IsString() @IsNotBlank() @MaxLength(TEMPLATE_LIMITS.nameMax) name: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(TEMPLATE_LIMITS.descriptionMax) description?: string;
  @Field(() => TemplateCategoryEnum, { nullable: true }) @IsOmittable() @IsIn(TEMPLATE_CATEGORIES) category?: TemplateCategory;
  @Field({ description: 'An exported template file, as JSON text' }) @IsString() @IsNotBlank() @MaxLength(TEMPLATE_LIMITS.importBytesMax) json: string;
}

