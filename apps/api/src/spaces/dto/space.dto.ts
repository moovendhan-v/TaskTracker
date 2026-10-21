import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  COLOR_PATTERN,
  NAME_MAX,
  type CreateSpaceRequest,
  type SpaceResponse,
  type UpdateSpaceRequest,
} from '@taskflow/shared-types';

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

export class UpdateSpaceDto extends PartialType(CreateSpaceDto) implements UpdateSpaceRequest {}

export class SpaceDto implements SpaceResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) workspaceId: string;
  @ApiProperty() name: string;
  @ApiProperty() color: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}
