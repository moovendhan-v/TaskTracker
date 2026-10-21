import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsUUID, MaxLength } from 'class-validator';
import type { AddMemberRequest } from '@taskflow/shared-types';

export class AddMemberDto implements AddMemberRequest {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  roleId: string;
}
