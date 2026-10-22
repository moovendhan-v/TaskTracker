import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DocumentQueryDto {
  @ApiPropertyOptional({ maxLength: 100, description: 'Matches page titles' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
