import { PartialType } from '@nestjs/swagger';
import type { UpdateSpaceRequest } from '@taskflow/shared-types';
import { CreateSpaceDto } from './create-space.dto.js';

export class UpdateSpaceDto extends PartialType(CreateSpaceDto) implements UpdateSpaceRequest {}
