import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller(['dashboard', 'api/dashboard'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MANAGER, Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Req() req: any) {
    return this.dashboardService.getSummary(req.user);
  }

  @Get('backlog-aging')
  async getBacklogAging(@Req() req: any) {
    return this.dashboardService.getBacklogAging(req.user);
  }

  @Get('workload')
  async getWorkload(@Req() req: any) {
    return this.dashboardService.getWorkload(req.user);
  }
}
