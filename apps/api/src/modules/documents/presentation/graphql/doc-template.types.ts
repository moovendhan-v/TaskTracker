import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { DOC_CONTENT_MAX, DOC_TEMPLATE_LIMITS, ICON_KEYS, type DocTemplateResponse, type IconKey, type SaveDocTemplateRequest } from '@taskflow/shared-types';
import { IconKeyEnum } from '../../../../core/graphql/enums.js';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('DocTemplate', { description: 'A page to start new pages from: built in, or saved in this workspace' })
export class DocTemplateGql implements DocTemplateResponse {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() description: string;
  @Field(() => IconKeyEnum, { nullable: true }) icon: IconKey | null;
  @Field({ description: 'Markdown; {{date}} becomes the day a page is made from it' }) content: string;
  @Field({ description: 'Ships with the app and can’t be deleted' }) builtIn: boolean;
  @Field(() => ID, { nullable: true }) createdById: string | null;
  @Field(() => String, { nullable: true }) createdAt: string | null;
}

@InputType('SaveDocTemplateInput')
export class SaveDocTemplateInput implements SaveDocTemplateRequest {
  @Field() @IsString() @IsNotBlank() @MaxLength(DOC_TEMPLATE_LIMITS.nameMax) name: string;
  @Field({ nullable: true }) @IsOmittable() @IsString() @MaxLength(DOC_TEMPLATE_LIMITS.descriptionMax) description?: string;
  @Field(() => IconKeyEnum, { nullable: true }) @IsClearable() @IsIn(ICON_KEYS) icon?: IconKey | null;
  @Field() @IsString() @MaxLength(DOC_CONTENT_MAX) content: string;
}
