import { Body, Controller, Ip, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public, RateLimit } from '../../common';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request/request-otp.dto';
import { VerifyOtpDto } from './dto/request/verify-otp.dto';
import { authConfig } from '../../config/auth.config';

// Per-IP budgets layered on top of the per-phone limits already enforced in
// AuthService: those stop one number being spammed, these stop a single host
// cycling through many numbers or brute-forcing codes and refresh tokens.
// `otp/request` and `otp/resend` deliberately share a bucket — they are the same
// operation, so separate counters would just double the attacker's budget.
const OTP_SEND_LIMIT = { limit: 10, windowSeconds: 600, bucket: 'auth:otp-send' };
const OTP_VERIFY_LIMIT = { limit: 20, windowSeconds: 600, bucket: 'auth:otp-verify' };
const REFRESH_LIMIT = { limit: 60, windowSeconds: 600, bucket: 'auth:refresh' };
// Logout is @Public (it must work with an expired access token) and writes
// to the database on every call, so without a ceiling it is a free
// unauthenticated DB-load vector. Its own bucket: spamming logout must not
// consume a legitimate client's refresh budget.
const LOGOUT_LIMIT = { limit: 60, windowSeconds: 600, bucket: 'auth:logout' };

@Controller('auth')
export class AuthController {
  private readonly settings = authConfig();

  constructor(private auth: AuthService) {}
  private set(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.settings.secureCookie,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: this.settings.refreshTokenTtlSeconds * 1000,
    });
  }
  @Public()
  @RateLimit(OTP_SEND_LIMIT)
  @Post('otp/request')
  request(@Body() d: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(d.phone, ip);
  }
  @Public()
  @RateLimit(OTP_SEND_LIMIT)
  @Post('otp/resend')
  resend(@Body() d: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(d.phone, ip);
  }
  @Public()
  @RateLimit(OTP_VERIFY_LIMIT)
  @Post('otp/verify')
  async verify(@Body() d: VerifyOtpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.verifyOtp(d.challengeId, d.phone, d.code, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.set(res, out.refreshToken);
    const { refreshToken, ...safe } = out;
    return safe;
  }
  @Public()
  @RateLimit(REFRESH_LIMIT)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.refresh(req.cookies?.refresh_token, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.set(res, out.refreshToken);
    const { refreshToken, ...safe } = out;
    return safe;
  }
  @Public()
  @RateLimit(LOGOUT_LIMIT)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.refresh_token ?? '');
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return { ok: true };
  }
}
