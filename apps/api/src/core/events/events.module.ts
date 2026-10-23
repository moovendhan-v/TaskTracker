import { Global, Module } from '@nestjs/common';
import { EventBus } from './event-bus.port.js';
import { InProcessEventBus } from './in-process-event-bus.js';

@Global()
@Module({
  providers: [{ provide: EventBus, useClass: InProcessEventBus }],
  exports: [EventBus],
})
export class EventsModule {}
