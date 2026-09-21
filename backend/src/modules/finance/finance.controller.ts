import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MaxLength, IsIn } from 'class-validator';
import { FinanceService } from './finance.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../../common/access/roles.guard';
import { Roles } from '../../common/access/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { UserPayload } from '../../common/types/user-payload.type';

class CreateCostDto {
  @IsString()
  @MaxLength(120)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsInt()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  incurred_on?: string;
}

class SettlePartnerDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(['cash', 'mobile_money', 'bank_transfer', 'other'])
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Synthèse financière (CA, commission, reversé, coûts, marge)' })
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.finance.summary(from, to);
  }

  @Get('partners')
  @ApiOperation({ summary: 'Montants dus par partenaire' })
  partners(@Query('from') from?: string, @Query('to') to?: string) {
    return this.finance.partners(from, to);
  }

  @Get('costs')
  @ApiOperation({ summary: 'Liste des coûts déclarés' })
  listCosts(@Query('from') from?: string, @Query('to') to?: string) {
    return this.finance.listCosts(from, to);
  }

  @Get('settlements')
  @ApiOperation({ summary: 'Historique des reversements partenaires' })
  listSettlements(@Query('from') from?: string, @Query('to') to?: string) {
    return this.finance.listSettlements(from, to);
  }

  @Get('settlements/:id')
  @ApiOperation({ summary: 'Détail d’un reversement (reçu)' })
  getSettlement(@Param('id') id: string) {
    return this.finance.getSettlement(id);
  }

  @Post('partners/:partnerId/settle')
  @ApiOperation({ summary: 'Solder / reverser le montant dû à un partenaire' })
  settlePartner(
    @Param('partnerId') partnerId: string,
    @Body() dto: SettlePartnerDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.finance.settlePartner(partnerId, dto, user.id);
  }

  @Post('costs')
  @ApiOperation({ summary: 'Déclarer un coût' })
  createCost(@Body() dto: CreateCostDto, @CurrentUser() user: UserPayload) {
    return this.finance.createCost(dto, user.id);
  }

  @Delete('costs/:id')
  @ApiOperation({ summary: 'Supprimer un coût déclaré' })
  deleteCost(@Param('id') id: string) {
    return this.finance.deleteCost(id);
  }
}
