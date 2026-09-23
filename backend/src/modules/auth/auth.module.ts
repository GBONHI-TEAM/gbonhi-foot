import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { AuthController } from './auth.controller';
import { RolesGuard } from '../../common/access/roles.guard';
import { OrangeSmsService } from '../sms/orange-sms.service';
import { PhoneOtpService } from './phone-otp.service';

@Module({
  controllers: [AuthController],
  providers: [SupabaseService, SupabaseAuthGuard, RolesGuard, OrangeSmsService, PhoneOtpService],
  exports: [SupabaseService, SupabaseAuthGuard, RolesGuard, OrangeSmsService, PhoneOtpService],
})
export class AuthModule {}
