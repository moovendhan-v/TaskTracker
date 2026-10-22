import { ArgsType, Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import {
  DOC_CONTENT_MAX,
  DOC_TITLE_MAX,
  type CreateDocumentRequest,
  type DocumentResponse,
  type DocumentSummaryResponse,
  type UpdateDocumentRequest,
} from '@taskflow/shared-types';

@ObjectType('DocumentSummary')
export class DocumentSummaryGql implements DocumentSummaryResponse {
  @Field(() => ID) id: string;
  @Field(() => ID, { nullable: true }) parentId: string | null;
  @Field(() => ID, { nullable: true }) spaceId: string | null;
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

@InputType()
export class CreateDocumentInput implements CreateDocumentRequest {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DOC_TITLE_MAX)
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(DOC_CONTENT_MAX)
  content?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  parentId?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  spaceId?: string | null;
}

@InputType()
export class UpdateDocumentInput implements UpdateDocumentRequest {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DOC_TITLE_MAX)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
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
