import { Controller, Get, UseGuards } from '@nestjs/common';
import { TerrainsService } from './terrains.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@UseGuards(SupabaseAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly terrainsService: TerrainsService) {}

  /** Tous les avis terrains (admin BO). */
  @Get()
  findAll() {
    return this.terrainsService.getAllReviews();
  }
}
