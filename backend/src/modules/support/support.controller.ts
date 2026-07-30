import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.type';

@UseGuards(SupabaseAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: UserPayload) {
    return this.support.create(user, dto);
  }

  @Get('tickets')
  list(
    @CurrentUser() user: UserPayload,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
  ) {
    return this.support.list(user, kind, status);
  }

  @Get('tickets/counts')
  counts(@CurrentUser() user: UserPayload, @Query('kind') kind?: string) {
    return this.support.counts(user, kind);
  }

  @Get('tickets/mine')
  mine(@CurrentUser() user: UserPayload) {
    return this.support.mine(user);
  }

  @Get('tickets/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.support.findOne(user, id);
  }

  @Patch('tickets/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.support.update(user, id, dto);
  }
}
