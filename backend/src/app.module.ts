import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { TicketsModule } from './tickets/tickets.module';
import { SlaModule } from './sla/sla.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health/health.controller';
import { CategoriesController } from './common/categories.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AdminModule,
    TicketsModule,
    SlaModule,
    SchedulerModule,
    DashboardModule,
  ],
  controllers: [HealthController, CategoriesController],
  providers: [],
})
export class AppModule {}
