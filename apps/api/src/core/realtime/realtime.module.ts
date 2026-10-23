import { Global, Module } from '@nestjs/common';
import { EventStream } from './event-stream.js';
import { RealtimeListener } from './realtime-listener.js';
import { RealtimePublisher } from './realtime-publisher.js';

@Global()
@Module({
  providers: [EventStream, RealtimePublisher, RealtimeListener],
  exports: [EventStream],
})
export class RealtimeModule {}
