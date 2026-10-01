import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
