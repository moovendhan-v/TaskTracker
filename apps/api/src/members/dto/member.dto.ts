import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsUUID, MaxLength } from 'class-validator';
import type { AddMemberRequest, MemberResponse, UpdateMemberRoleRequest } from '@taskflow/shared-types';

export class AddMemberDto implements AddMemberRequest {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  roleId: string;
}

export class UpdateMemberRoleDto implements UpdateMemberRoleRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  roleId: string;
}

export class MemberDto implements MemberResponse {
  @ApiProperty() userId: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ format: 'uuid' }) roleId: string;
  @ApiProperty() roleName: string;
  @ApiProperty({ format: 'date-time' }) joinedAt: string;
}

export class AddMemberResultDto {
  @ApiProperty() message: string;
}
