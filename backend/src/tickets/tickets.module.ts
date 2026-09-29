import { Module } from '@nestjs/common';
import { AgentQueueController } from './agent-queue.controller';

@Module({
  controllers: [AgentQueueController],
})
export class TicketsModule {}
