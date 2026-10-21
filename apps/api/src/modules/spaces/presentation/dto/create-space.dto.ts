import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { COLOR_PATTERN, NAME_MAX, type CreateSpaceRequest } from '@taskflow/shared-types';

export class CreateSpaceDto implements CreateSpaceRequest {
  @ApiProperty({ maxLength: NAME_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name: string;

  @ApiPropertyOptional({ pattern: COLOR_PATTERN })
  @IsOptional()
  @Matches(new RegExp(COLOR_PATTERN))
  color?: string;
}
