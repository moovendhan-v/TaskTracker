import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAccess } from '../../../../core/access/current-access.decorator.js';
import { RequirePermissions } from '../../../../core/access/require-permissions.decorator.js';
import { CurrentActor } from '../../../../core/http/decorators/current-actor.decorator.js';
import type { Actor, WorkspaceAccess } from '../../../../core/http/types/authenticated-request.js';
import { EmployeesService } from '../application/employees.service.js';
import { EmployeeResponseDto } from './dto/employee.response.dto.js';
import { UpsertEmployeeProfileDto } from './dto/upsert-employee-profile.dto.js';

@ApiTags('hr')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/hr/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions('hr.view')
  @ApiOkResponse({ type: EmployeeResponseDto, isArray: true })
  directory(@CurrentAccess() access: WorkspaceAccess): Promise<EmployeeResponseDto[]> {
    return this.employeesService.directory(access.workspaceId);
  }

  @Get(':userId')
  @RequirePermissions('hr.view')
  @ApiOkResponse({ type: EmployeeResponseDto })
  get(@CurrentAccess() access: WorkspaceAccess, @Param('userId') userId: string): Promise<EmployeeResponseDto> {
    return this.employeesService.get(access.workspaceId, userId);
  }

  @Put(':userId')
  @RequirePermissions('hr.manage')
  @ApiOkResponse({ type: EmployeeResponseDto })
  upsert(
    @CurrentActor() actor: Actor,
    @CurrentAccess() access: WorkspaceAccess,
    @Param('userId') userId: string,
    @Body() dto: UpsertEmployeeProfileDto,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.upsert(actor, access.workspaceId, userId, dto);
  }
}
