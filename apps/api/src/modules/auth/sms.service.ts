import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { config } from '../../config';
@Injectable()
export class SmsService {
  constructor(private db: PrismaService) {}
  async sendOtp(phone: string, code: string, userId?: string) {
    const cfg = config();
    let providerId: string;
    let response: object;
    if (cfg.KAVENEGAR_API_KEY) {
      const r = await fetch(
        `${cfg.KAVENEGAR_API_BASE}/v1/${cfg.KAVENEGAR_API_KEY}/verify/lookup.json?receptor=${encodeURIComponent(phone)}&token=${code}&template=${encodeURIComponent(cfg.KAVENEGAR_OTP_TEMPLATE)}`,
        { method: 'POST' },
      );
      if (!r.ok) throw new ServiceUnavailableException('SMS provider unavailable');
      response = (await r.json()) as object;
      providerId = `kavenegar-${Date.now()}`;
    } else if (cfg.AUTH_DEV_OTP) {
      // Local development only: no provider is configured, so the code is echoed
      // back to the caller instead of being delivered.
      providerId = `development-${Date.now()}`;
      response = { adapter: 'development', code };
    } else {
      // Fail closed: without a provider the code can never reach the user, so
      // refuse the login rather than persist a "sent" notification for an OTP
      // nobody received.
      throw new ServiceUnavailableException('SMS provider unavailable');
    }
    const notification = await this.db.notification.create({
      data: {
        userId: userId ?? (await this.ensureUser(phone)),
        type: 'otp',
        titleFa: 'کد ورود',
        titleEn: 'Login code',
        bodyFa: 'کد ورود ارسال شد',
        bodyEn: 'Login code sent',
        deliveries: {
          create: { channel: 'SMS', status: 'sent', providerId, providerResponse: response, sentAt: new Date() },
        },
      },
    });
    return { notificationId: notification.id, developmentCode: cfg.AUTH_DEV_OTP ? code : undefined };
  }
  private async ensureUser(phone: string) {
    return (
      await this.db.user.upsert({
        where: { phone },
        update: {},
        create: { phone, roles: { create: { role: 'STUDENT' } } },
      })
    ).id;
  }
}
