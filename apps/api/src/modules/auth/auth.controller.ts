import { Body, Controller, Ip, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, Public, RateLimit, PublicRateLimit, type AuthUser } from '../../common';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request/request-otp.dto';
import { VerifyOtpDto } from './dto/request/verify-otp.dto';
import { authConfig } from '../../config/auth.config';
import { SessionMapper } from './mappers/session.mapper';
import { GoogleAuthDto } from './dto/request/google-auth.dto';
import { PasswordLoginDto, PasswordRegisterDto, SetPasswordDto } from './dto/request/password-auth.dto';

// Per-IP budgets layered on top of the per-phone limits already enforced in
// AuthService: those stop one number being spammed, these stop a single host
// cycling through many numbers or brute-forcing codes and refresh tokens.
// `otp/request` and `otp/resend` deliberately share a bucket — they are the same
// operation, so separate counters would just double the attacker's budget.
// Per-phone cooldown/hourly limits still protect the SMS destination. This
// wider IP bucket mainly stops one host cycling through many numbers without
// locking out a household, office, mobile carrier NAT, or the local E2E suite.
const OTP_SEND_LIMIT = { limit: 30, windowSeconds: 600, bucket: 'auth:otp-send' };
const OTP_VERIFY_LIMIT = { limit: 20, windowSeconds: 600, bucket: 'auth:otp-verify' };
const REFRESH_LIMIT = { limit: 60, windowSeconds: 600, bucket: 'auth:refresh' };
// Logout is @Public (it must work with an expired access token) and writes
// to the database on every call, so without a ceiling it is a free
// unauthenticated DB-load vector. Its own bucket: spamming logout must not
// consume a legitimate client's refresh budget.
const LOGOUT_LIMIT = { limit: 60, windowSeconds: 600, bucket: 'auth:logout' };
const PASSWORD_LIMIT = { limit: 20, windowSeconds: 600, bucket: 'auth:password' };

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
  @PublicRateLimit(OTP_SEND_LIMIT)
  @Post('otp/request')
  request(@Body() d: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(d.phone, ip);
  }
  @PublicRateLimit(OTP_SEND_LIMIT)
  @Post('otp/resend')
  resend(@Body() d: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(d.phone, ip);
  }
  @PublicRateLimit(OTP_VERIFY_LIMIT)
  @Post('otp/verify')
  async verify(@Body() d: VerifyOtpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.verifyOtp(d.challengeId, d.phone, d.code, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.set(res, out.refreshToken);
    return SessionMapper.toResponse(out);
  }
  @PublicRateLimit(PASSWORD_LIMIT)
  @Post('password/login')
  async passwordLogin(@Body() d: PasswordLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.loginWithPassword(d.identity, d.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.set(res, out.refreshToken);
    return SessionMapper.toResponse(out);
  }
  @PublicRateLimit(PASSWORD_LIMIT)
  @Post('password/register')
  async passwordRegister(
    @Body() d: PasswordRegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.registerWithPassword(d.name, d.identity, d.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.set(res, out.refreshToken);
    return SessionMapper.toResponse(out);
  }
  @Post('password/set')
  setPassword(@CurrentUser() user: AuthUser, @Body() d: SetPasswordDto) {
    return this.auth.setPassword(user.id, d.password);
  }
  @PublicRateLimit(OTP_VERIFY_LIMIT)
  @Post('google')
  async google(@Body() d: GoogleAuthDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.verifyGoogle(d.credential, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.set(res, out.refreshToken);
    return SessionMapper.toResponse(out);
  }
  @PublicRateLimit(REFRESH_LIMIT)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.refresh(req.cookies?.refresh_token, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.set(res, out.refreshToken);
    return SessionMapper.toResponse(out);
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
