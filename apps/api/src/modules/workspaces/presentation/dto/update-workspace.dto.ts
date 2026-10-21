import { PartialType } from '@nestjs/swagger';
import type { UpdateWorkspaceRequest } from '@taskflow/shared-types';
import { CreateWorkspaceDto } from './create-workspace.dto.js';

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) implements UpdateWorkspaceRequest {}
