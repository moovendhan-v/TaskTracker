import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import type { MoveDocumentRequest } from '@taskflow/shared-types';

export class MoveDocumentDto implements MoveDocumentRequest {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'null moves the page to the top level' })
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  parentId: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;
}
