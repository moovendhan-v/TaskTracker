import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { DOC_CONTENT_MAX, DOC_TITLE_MAX, type CreateDocumentRequest } from '@taskflow/shared-types';

export class CreateDocumentDto implements CreateDocumentRequest {
  @ApiProperty({ maxLength: DOC_TITLE_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(DOC_TITLE_MAX)
  title: string;

  @ApiPropertyOptional({ maxLength: DOC_CONTENT_MAX, description: 'Markdown' })
  @IsOptional()
  @IsString()
  @MaxLength(DOC_CONTENT_MAX)
  content?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  parentId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  spaceId?: string | null;
}
