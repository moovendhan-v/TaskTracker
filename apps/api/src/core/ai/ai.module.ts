import { Global, Module } from '@nestjs/common';
import { AiModelRegistry } from './ai-model.registry.js';

/** The AI provider layer, shared by every feature that uses a model. */
@Global()
@Module({
  providers: [AiModelRegistry],
  exports: [AiModelRegistry],
})
export class AiModule {}
