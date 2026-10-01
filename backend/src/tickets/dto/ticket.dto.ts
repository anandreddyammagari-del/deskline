import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { Priority, TicketStatus } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;
}

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  @IsNotEmpty()
  status: TicketStatus;

  @IsString()
  @IsOptional()
  note?: string;
}

export class AssignTicketDto {
  @IsString()
  @IsNotEmpty()
  assigneeId: string;

  @IsOptional()
  expectedCurrentAssigneeId?: string | null;
}

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  isInternal?: boolean;
}
