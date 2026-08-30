import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PublicAuthController } from './public/public-auth.controller';
import { PublicAuthService } from './public/public-auth.service';
import { OtpService } from './public/otp.service';
import { StaffAuthController } from './staff/staff-auth.controller';
import { StaffAuthService } from './staff/staff-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleOAuthStrategy } from './strategies/google-oauth.strategy';
import { MicrosoftOAuthStrategy } from './strategies/microsoft-oauth.strategy';
import { RefreshTokenService } from './refresh-token.service';
import { DeviceService } from './device.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // الأسرار تُمرَّر لكل توقيع/تحقق على حدة (Access مقابل Refresh)
    NotificationsModule,
  ],
  controllers: [PublicAuthController, StaffAuthController],
  providers: [
    PublicAuthService,
    StaffAuthService,
    OtpService,
    JwtStrategy,
    RefreshTokenService,
    DeviceService,
    // استراتيجيات OAuth تُسجَّل دائمًا؛ في حال عدم ضبط GOOGLE/MICROSOFT_CLIENT_ID فعليًا
    // ستُرجع Google/Microsoft خطأ عند محاولة استخدام الزر فقط، دون كسر إقلاع التطبيق
    GoogleOAuthStrategy,
    MicrosoftOAuthStrategy,
  ],
  exports: [PublicAuthService, StaffAuthService, RefreshTokenService],
})
export class AuthModule {}
