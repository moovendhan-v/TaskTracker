import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { DepartmentsService } from './departments/application/departments.service.js';
import { DepartmentRepository } from './departments/domain/department.repository.js';
import { TypeOrmDepartmentRepository } from './departments/infrastructure/typeorm-department.repository.js';
import { DepartmentsController } from './departments/presentation/departments.controller.js';
import { DepartmentsResolver } from './departments/presentation/graphql/departments.resolver.js';
import { EmployeesService } from './employees/application/employees.service.js';
import { EmployeeProfileRepository } from './employees/domain/employee-profile.repository.js';
import { TypeOrmEmployeeProfileRepository } from './employees/infrastructure/typeorm-employee-profile.repository.js';
import { EmployeesController } from './employees/presentation/employees.controller.js';
import { EmployeesResolver } from './employees/presentation/graphql/employees.resolver.js';
import { LeaveRequestsService } from './leave/application/leave-requests.service.js';
import { LeaveTypesService } from './leave/application/leave-types.service.js';
import { LeaveBalanceRepository } from './leave/domain/leave-balance.repository.js';
import { LeaveRequestRepository } from './leave/domain/leave-request.repository.js';
import { LeaveTypeRepository } from './leave/domain/leave-type.repository.js';
import { TypeOrmLeaveBalanceRepository } from './leave/infrastructure/typeorm-leave-balance.repository.js';
import { TypeOrmLeaveRequestRepository } from './leave/infrastructure/typeorm-leave-request.repository.js';
import { TypeOrmLeaveTypeRepository } from './leave/infrastructure/typeorm-leave-type.repository.js';
import { LeaveResolver } from './leave/presentation/graphql/leave.resolver.js';
import { LeaveRequestsController } from './leave/presentation/leave-requests.controller.js';
import { LeaveTypesController } from './leave/presentation/leave-types.controller.js';

/** People features: departments, employee profiles and time off. */
@Module({
  imports: [MembersModule],
  controllers: [DepartmentsController, EmployeesController, LeaveTypesController, LeaveRequestsController],
  providers: [
    DepartmentsService,
    EmployeesService,
    LeaveTypesService,
    LeaveRequestsService,
    DepartmentsResolver,
    EmployeesResolver,
    LeaveResolver,
    { provide: DepartmentRepository, useClass: TypeOrmDepartmentRepository },
    { provide: EmployeeProfileRepository, useClass: TypeOrmEmployeeProfileRepository },
    { provide: LeaveTypeRepository, useClass: TypeOrmLeaveTypeRepository },
    { provide: LeaveRequestRepository, useClass: TypeOrmLeaveRequestRepository },
    { provide: LeaveBalanceRepository, useClass: TypeOrmLeaveBalanceRepository },
  ],
})
export class HrModule {}
