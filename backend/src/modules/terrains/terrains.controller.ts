import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TerrainsService } from './terrains.service';
import { CreateTerrainDto } from './dto/create-terrain.dto';
import { CreateAdminTerrainDto } from './dto/create-admin-terrain.dto';
import { UpdateTerrainDto } from './dto/update-terrain.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.type';
import { Roles } from '../../common/access/roles.decorator';
import { RolesGuard } from '../../common/access/roles.guard';

@UseGuards(SupabaseAuthGuard)
@Controller('terrains')
export class TerrainsController {
  constructor(private readonly terrainsService: TerrainsService) {}

  @Get()
  findAll(@Query('city') city?: string) {
    return this.terrainsService.findAll({ city });
  }

  @Get('mine')
  findMine(@CurrentUser() user: UserPayload) {
    return this.terrainsService.findMine(user);
  }

  /** Liste de gestion : inclut les terrains inactifs et leur partenaire. */
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATEUR')
  findAllAdmin() {
    return this.terrainsService.findAllAdmin();
  }

  @Get('favorites')
  findFavorites(@CurrentUser() user: UserPayload) {
    return this.terrainsService.findFavorites(user);
  }

  @Get('reviews/pending')
  findPendingReview(@CurrentUser() user: UserPayload) {
    return this.terrainsService.findPendingReview(user);
  }

  @Get('mine/reviews')
  findMyTerrainReviews(@CurrentUser() user: UserPayload) {
    return this.terrainsService.findReviewsForPartner(user);
  }

  @Post()
  create(@Body() dto: CreateTerrainDto, @CurrentUser() user: UserPayload) {
    return this.terrainsService.create(dto, user);
  }

  /** Le BO ne crée jamais un terrain au nom de l'administrateur connecté. */
  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  createForAdmin(@Body() dto: CreateAdminTerrainDto) {
    return this.terrainsService.createForAdmin(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.terrainsService.findOne(id);
  }

  @Post(':id/favorite')
  addFavorite(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.terrainsService.addFavorite(id, user);
  }

  @Delete(':id/favorite')
  removeFavorite(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.terrainsService.removeFavorite(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTerrainDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.terrainsService.update(id, dto, user);
  }

  @Get(':id/slots')
  getSlots(@Param('id') id: string) {
    return this.terrainsService.getSlots(id);
  }

  @Post(':id/slots')
  addSlot(
    @Param('id') id: string,
    @Body() dto: CreateSlotDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.terrainsService.addSlot(id, dto, user);
  }

  @Delete(':id/slots/:slotId')
  removeSlot(
    @Param('id') id: string,
    @Param('slotId') slotId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.terrainsService.removeSlot(id, slotId, user);
  }

  @Get(':id/availability')
  getAvailability(
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    return this.terrainsService.getAvailability(id, date);
  }

  @Get(':id/reviews')
  getReviews(@Param('id') id: string) {
    return this.terrainsService.getReviews(id);
  }

  @Post(':id/reviews')
  addReview(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.terrainsService.addReview(id, dto, user);
  }

  @Get(':id/blocks')
  getBlocks(@Param('id') id: string) {
    return this.terrainsService.getBlocks(id);
  }

  @Post(':id/blocks')
  addBlock(
    @Param('id') id: string,
    @Body() dto: CreateBlockDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.terrainsService.addBlock(id, dto, user);
  }

  @Delete(':id/blocks/:blockId')
  removeBlock(
    @Param('id') id: string,
    @Param('blockId') blockId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.terrainsService.removeBlock(id, blockId, user);
  }
}
