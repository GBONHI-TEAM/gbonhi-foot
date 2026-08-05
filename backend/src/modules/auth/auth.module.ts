import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { AuthController } from './auth.controller';
import { RolesGuard } from '../../common/access/roles.guard';

@Module({
  controllers: [AuthController],
  providers: [SupabaseService, SupabaseAuthGuard, RolesGuard],
  exports: [SupabaseService, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
