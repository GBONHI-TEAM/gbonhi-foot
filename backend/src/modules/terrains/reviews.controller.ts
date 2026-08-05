import { Controller, Get, UseGuards } from '@nestjs/common';
import { TerrainsService } from './terrains.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly terrainsService: TerrainsService) {}

  /** Tous les avis terrains (admin BO). */
  @Get()
  findAll() {
    return this.terrainsService.getAllReviews();
  }
}
