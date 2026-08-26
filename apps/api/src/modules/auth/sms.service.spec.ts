const configValue = {
  AUTH_DEV_OTP: false,
  KAVENEGAR_OTP_TEMPLATE: 'lingospeak-otp',
};

jest.mock('../../config', () => ({ config: () => configValue }));

import { SmsService } from './sms.service';

describe('SmsService OTP delivery boundary', () => {
  const db = {
    notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) },
    user: { upsert: jest.fn() },
  } as any;

  beforeEach(() => jest.clearAllMocks());

  it('keeps OTP delivery synchronous and records success only after provider acceptance', async () => {
    const provider = {
      configured: true,
      sendLookup: jest.fn().mockResolvedValue({ providerId: 'provider-1', response: { status: 200 } }),
    } as any;
    const service = new SmsService(db, provider);

    await expect(service.sendOtp('09120000000', '123456', 'user-1')).resolves.toEqual({
      notificationId: 'notification-1',
      developmentCode: undefined,
    });
    expect(provider.sendLookup).toHaveBeenCalledWith({
      phone: '09120000000',
      template: 'lingospeak-otp',
      tokens: ['123456'],
    });
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'otp',
        deliveries: { create: expect.objectContaining({ channel: 'SMS', status: 'sent', providerId: 'provider-1' }) },
      }),
    });
  });

  it('fails closed and does not record a sent notification when delivery fails', async () => {
    const provider = {
      configured: true,
      sendLookup: jest.fn().mockRejectedValue(new Error('provider failure')),
    } as any;
    const service = new SmsService(db, provider);

    await expect(service.sendOtp('09120000000', '123456', 'user-1')).rejects.toMatchObject({ status: 503 });
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('fails closed when no provider is configured and development OTP is disabled', async () => {
    const provider = { configured: false, sendLookup: jest.fn() } as any;
    const service = new SmsService(db, provider);

    await expect(service.sendOtp('09120000000', '123456', 'user-1')).rejects.toMatchObject({ status: 503 });
    expect(provider.sendLookup).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});
