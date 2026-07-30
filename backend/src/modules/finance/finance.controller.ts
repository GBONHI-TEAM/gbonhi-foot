import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { FinanceService } from './finance.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
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

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Synthèse financière (CA, commission, reversé, coûts, marge)' })
  summary() {
    return this.finance.summary();
  }

  @Get('partners')
  @ApiOperation({ summary: 'Montants dus par partenaire' })
  partners() {
    return this.finance.partners();
  }

  @Get('costs')
  @ApiOperation({ summary: 'Liste des coûts déclarés' })
  listCosts() {
    return this.finance.listCosts();
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
