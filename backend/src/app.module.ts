import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { TicketsModule } from './tickets/tickets.module';
import { HealthController } from './health/health.controller';
import { CategoriesController } from './common/categories.controller';

@Module({
  imports: [PrismaModule, AuthModule, AdminModule, TicketsModule],
  controllers: [HealthController, CategoriesController],
  providers: [],
})
export class AppModule {}
