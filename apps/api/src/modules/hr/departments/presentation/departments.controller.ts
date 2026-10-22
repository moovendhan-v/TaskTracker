import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import { UUID_PIPE } from '../../../../core/http/pipes/uuid.pipe.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { DepartmentsService } from '../application/departments.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { DepartmentResponseDto } from './dto/department.response.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';

@ApiTags('hr')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/hr/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions('hr.view')
  @ApiOkResponse({ type: DepartmentResponseDto, isArray: true })
  list(@CurrentAccess() access: WorkspaceAccess): Promise<DepartmentResponseDto[]> {
    return this.departmentsService.list(access.workspaceId);
  }

  @Post()
  @RequirePermissions('hr.manage')
  @ApiOkResponse({ type: DepartmentResponseDto })
  create(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Body() dto: CreateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    return this.departmentsService.create(actor, access.workspaceId, dto);
  }

  @Patch(':departmentId')
  @RequirePermissions('hr.manage')
  @ApiOkResponse({ type: DepartmentResponseDto })
  update(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('departmentId', UUID_PIPE) departmentId: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    return this.departmentsService.update(actor, access.workspaceId, departmentId, dto);
  }

  @Delete(':departmentId')
  @RequirePermissions('hr.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('departmentId', UUID_PIPE) departmentId: string,
  ): Promise<void> {
    return this.departmentsService.remove(actor, access.workspaceId, departmentId);
  }
}
