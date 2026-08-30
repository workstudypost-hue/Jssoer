import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PublicAuthService } from './public-auth.service';
import { RegisterDto } from '../dto/register.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { GoogleOAuthGuard } from '../guards/google-oauth.guard';
import { MicrosoftOAuthGuard } from '../guards/microsoft-oauth.guard';
import { OAuthProfile } from '../strategies/google-oauth.strategy';

/**
 * مسارات المصادقة العامة (طلاب/مدربون - تسجيل ذاتي).
 * لا يوجد هنا أي مسار لإنشاء حساب "موظف" - هذا مفصول بالكامل
 * في StaffAuthController تحت /auth/staff فقط.
 */
@Controller('auth/public')
export class PublicAuthController {
  constructor(private readonly publicAuthService: PublicAuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.publicAuthService.register(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request, @Ip() ip: string) {
    return this.publicAuthService.verifyRegistrationOtp(
      dto.identifier,
      dto.code,
      dto.deviceFingerprint,
      ip,
      req.headers['user-agent'],
    );
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request, @Ip() ip: string) {
    return this.publicAuthService.login(dto, dto.deviceFingerprint, ip, req.headers['user-agent']);
  }

  /** تدوير Refresh Token (يُستدعى تلقائيًا من الـ Frontend عند انتهاء Access Token) */
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request, @Ip() ip: string) {
    return this.publicAuthService.refresh(dto.refreshToken, ip, req.headers['user-agent']);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto & { sessionToken?: string }) {
    return this.publicAuthService.logout(dto.refreshToken, dto.sessionToken);
  }

  // ============ Google OAuth ============
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleLogin() {
    // لا يُنفَّذ أي كود هنا - Passport يُعيد التوجيه فورًا إلى Google
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response, @Ip() ip: string) {
    const profile = req.user as OAuthProfile;
    const tokens = await this.publicAuthService.handleOAuthLogin(
      profile,
      undefined,
      ip,
      req.headers['user-agent'],
    );
    this.redirectWithTokens(res, tokens);
  }

  // ============ Microsoft OAuth ============
  @Get('microsoft')
  @UseGuards(MicrosoftOAuthGuard)
  microsoftLogin() {}

  @Get('microsoft/callback')
  @UseGuards(MicrosoftOAuthGuard)
  async microsoftCallback(@Req() req: Request, @Res() res: Response, @Ip() ip: string) {
    const profile = req.user as OAuthProfile;
    const tokens = await this.publicAuthService.handleOAuthLogin(
      profile,
      undefined,
      ip,
      req.headers['user-agent'],
    );
    this.redirectWithTokens(res, tokens);
  }

  /**
   * إعادة توجيه للـ Frontend مع التوكنات في الـ URL Fragment (وليس Query String) -
   * الـ Fragment (#) لا يُرسَل للخادم في أي طلب لاحق ولا يظهر في سجلات الـ Access logs،
   * مما يقلل خطر تسريب التوكن عبر Referer headers أو سجلات الخادم.
   */
  private redirectWithTokens(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const fragment = `access_token=${encodeURIComponent(tokens.accessToken)}&refresh_token=${encodeURIComponent(tokens.refreshToken)}`;
    res.redirect(`${frontendUrl}/auth/oauth-callback#${fragment}`);
  }
}
