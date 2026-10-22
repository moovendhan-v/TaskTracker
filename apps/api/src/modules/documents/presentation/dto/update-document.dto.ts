import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { DOC_CONTENT_MAX, DOC_TITLE_MAX, type UpdateDocumentRequest } from '@taskflow/shared-types';

export class UpdateDocumentDto implements UpdateDocumentRequest {
  @ApiPropertyOptional({ maxLength: DOC_TITLE_MAX })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DOC_TITLE_MAX)
  title?: string;

  @ApiPropertyOptional({ maxLength: DOC_CONTENT_MAX, description: 'Markdown' })
  @IsOptional()
  @IsString()
  @MaxLength(DOC_CONTENT_MAX)
  content?: string;
}
