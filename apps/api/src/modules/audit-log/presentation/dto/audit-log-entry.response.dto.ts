import { ApiProperty } from '@nestjs/swagger';
import type { AuditLogEntryResponse, Paginated } from '@taskflow/shared-types';

export class AuditLogEntryResponseDto implements AuditLogEntryResponse {
  @ApiProperty() id: string;
  @ApiProperty() actorId: string;
  @ApiProperty() actorName: string;
  @ApiProperty() action: string;
  @ApiProperty() targetType: string;
  @ApiProperty({ type: String, nullable: true }) targetId: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) workspaceId: string | null;
  @ApiProperty({ type: String, nullable: true }) ip: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) metadata: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class AuditLogPageResponseDto implements Paginated<AuditLogEntryResponseDto> {
  @ApiProperty({ type: AuditLogEntryResponseDto, isArray: true }) items: AuditLogEntryResponseDto[];
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}
