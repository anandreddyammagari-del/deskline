import { Module } from '@nestjs/common';
import { SlaService } from './sla.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
