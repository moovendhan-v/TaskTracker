import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { COMMENT_BODY_MAX, type CreateCommentRequest } from '@taskflow/shared-types';

export class CreateCommentDto implements CreateCommentRequest {
  @ApiProperty({ maxLength: COMMENT_BODY_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_BODY_MAX)
  body: string;
}
