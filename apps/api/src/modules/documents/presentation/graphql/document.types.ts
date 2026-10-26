import { ArgsType, Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  DOC_CONTENT_MAX,
  DOC_KINDS,
  DOC_TITLE_MAX,
  type CreateDocumentRequest,
  type DocKind,
  type DocumentResponse,
  type DocumentSummaryResponse,
  type UpdateDocumentRequest,
} from '@taskflow/shared-types';
import { DocKindEnum } from '../../../../core/graphql/enums.js';
import { IsClearable, IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';

@ObjectType('DocumentSummary')
export class DocumentSummaryGql implements DocumentSummaryResponse {
  @Field(() => ID) id: string;
  @Field(() => ID, { nullable: true }) parentId: string | null;
  @Field(() => ID, { nullable: true }) spaceId: string | null;
  @Field(() => DocKindEnum) kind: DocKind;
  @Field() title: string;
  @Field(() => Float) position: number;
  @Field(() => ID) createdById: string;
  @Field() updatedAt: string;
}

@ObjectType('Document')
export class DocumentGql extends DocumentSummaryGql implements DocumentResponse {
  @Field({ description: 'Markdown; render without raw HTML' }) content: string;
  @Field() createdAt: string;
}

@FormSchema('document.create')
@InputType()
export class CreateDocumentInput implements CreateDocumentRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(DOC_TITLE_MAX)
  title: string;

  @Field(() => DocKindEnum, { nullable: true, description: 'Defaults to page' })
  @IsOmittable()
  @IsIn(DOC_KINDS)
  kind?: DocKind;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(DOC_CONTENT_MAX)
  content?: string;

  @Field(() => ID, { nullable: true })
  @IsClearable()
  @IsUUID('4')
  parentId?: string | null;

  @Field(() => ID, { nullable: true })
  @IsClearable()
  @IsUUID('4')
  spaceId?: string | null;
}

@FormSchema('document.update')
@InputType()
export class UpdateDocumentInput implements UpdateDocumentRequest {
  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @IsNotBlank()
  @MaxLength(DOC_TITLE_MAX)
  title?: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(DOC_CONTENT_MAX)
  content?: string;
}

@ArgsType()
export class DocumentTreeArgs {
  @Field(() => ID)
  @IsUUID('4')
  workspaceId: string;

  @Field({ nullable: true, description: 'Matches page titles' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
