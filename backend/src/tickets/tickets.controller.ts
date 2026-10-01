import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  CreateTicketDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  CreateCommentDto,
} from './dto/ticket.dto';

@Controller(['tickets', 'api/tickets'])
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Roles(Role.EMPLOYEE, Role.ADMIN)
  async createTicket(@Req() req: any, @Body() dto: CreateTicketDto) {
    return this.ticketsService.createTicket(req.user, dto);
  }

  @Get('mine')
  @Roles(Role.EMPLOYEE, Role.AGENT, Role.MANAGER, Role.ADMIN)
  async getRequesterTickets(@Req() req: any) {
    return this.ticketsService.getRequesterTickets(req.user.id);
  }

  @Get()
  @Roles(Role.AGENT, Role.MANAGER, Role.ADMIN)
  async getScopedTickets(@Req() req: any) {
    return this.ticketsService.getScopedTickets(req.user);
  }

  @Get(':id')
  async getTicketById(@Req() req: any, @Param('id') id: string) {
    return this.ticketsService.getTicketById(req.user, id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateStatus(req.user, id, dto);
  }

  @Patch(':id/assign')
  @Roles(Role.MANAGER, Role.ADMIN)
  async assignTicket(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.ticketsService.assignTicket(req.user, id, dto);
  }

  @Post(':id/comments')
  async addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.ticketsService.addComment(req.user, id, dto);
  }
}
