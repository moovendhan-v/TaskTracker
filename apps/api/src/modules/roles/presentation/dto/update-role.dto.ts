import { PartialType } from '@nestjs/swagger';
import type { UpdateRoleRequest } from '@taskflow/shared-types';
import { CreateRoleDto } from './create-role.dto.js';

export class UpdateRoleDto extends PartialType(CreateRoleDto) implements UpdateRoleRequest {}
