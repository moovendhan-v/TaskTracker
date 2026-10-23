import { type DynamicModule, Global, Module, type ModuleMetadata, type Type } from '@nestjs/common';
import { AccessService } from './access.service.js';
import { MembershipReader } from './membership-reader.port.js';
import { WorkspaceAccessGuard } from './workspace-access.guard.js';

export interface AccessModuleOptions {
  /** Modules that export the reader adapter. */
  imports: ModuleMetadata['imports'];
  /** Adapter for the MembershipReader port, supplied by the composition root. */
  membershipReader: Type<MembershipReader>;
}

@Global()
@Module({})
export class AccessModule {
  static forRoot(options: AccessModuleOptions): DynamicModule {
    return {
      module: AccessModule,
      imports: options.imports ?? [],
      providers: [
        { provide: MembershipReader, useExisting: options.membershipReader },
        AccessService,
        WorkspaceAccessGuard,
      ],
      exports: [AccessService, WorkspaceAccessGuard],
    };
  }
}
