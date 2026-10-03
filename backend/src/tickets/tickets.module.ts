import { Module } from '@nestjs/common';
import { AgentQueueController } from './agent-queue.controller';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { RoutingModule } from '../routing/routing.module';
import { SlaModule } from '../sla/sla.module';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule, RoutingModule, SlaModule],
  controllers: [AgentQueueController, TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}

