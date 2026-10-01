import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DepartmentScopeGuard } from '../common/guards/department-scope.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';

@Controller(['agent', 'api/agent'])
@UseGuards(JwtAuthGuard, RolesGuard, DepartmentScopeGuard)
@Roles(Role.AGENT, Role.MANAGER, Role.ADMIN)
export class AgentQueueController {
  constructor(private ticketsService: TicketsService) {}

  @Get('queue')
  async getQueue(@CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.getAgentQueue(user as any);
  }
}
