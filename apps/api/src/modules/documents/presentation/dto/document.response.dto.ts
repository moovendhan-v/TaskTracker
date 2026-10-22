import { ApiProperty } from '@nestjs/swagger';
import type { DocumentResponse, DocumentSummaryResponse } from '@taskflow/shared-types';

export class DocumentSummaryResponseDto implements DocumentSummaryResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) parentId: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) spaceId: string | null;
  @ApiProperty() title: string;
  @ApiProperty() position: number;
  @ApiProperty() createdById: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class DocumentResponseDto extends DocumentSummaryResponseDto implements DocumentResponse {
  @ApiProperty({ description: 'Markdown; render without raw HTML' }) content: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}
