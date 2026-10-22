import { ApiProperty } from '@nestjs/swagger';
import type { CommentResponse } from '@taskflow/shared-types';

export class CommentResponseDto implements CommentResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) taskId: string;
  @ApiProperty() authorId: string;
  @ApiProperty() authorName: string;
  @ApiProperty({ description: 'Plain text; render as text, never HTML.' }) body: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}
