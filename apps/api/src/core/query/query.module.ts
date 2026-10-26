import { Global, Module } from '@nestjs/common';
import { EnumOptionsRegistry } from './enum-options.registry.js';

@Global()
@Module({
  providers: [EnumOptionsRegistry],
  exports: [EnumOptionsRegistry],
})
export class QueryModule {}
