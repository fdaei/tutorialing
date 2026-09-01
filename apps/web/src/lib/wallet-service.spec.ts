import { api } from '@/shared/services/api';
import { walletService } from './wallet-service';

jest.mock('@/shared/services/api', () => ({ api: jest.fn() }));

const mockedApi = jest.mocked(api);

describe('walletService', () => {
  afterEach(() => mockedApi.mockReset());

  it.each([
    ['booking', 'پرداخت کلاس'],
    ['BOOKING', 'پرداخت کلاس'],
    ['package', 'پرداخت بسته آموزشی'],
    ['wallet_top_up', 'افزایش موجودی کیف پول'],
    ['other', 'پرداخت'],
  ])('maps the %s invoice purpose to its accurate title', async (purpose, title) => {
    mockedApi.mockResolvedValueOnce([
      { id: 'invoice-1', purpose, amount: 100_000, status: 'PAID', createdAt: '2026-09-01T00:00:00Z' },
    ]);

    await expect(walletService.getInvoices()).resolves.toEqual([expect.objectContaining({ id: 'invoice-1', title })]);
  });
});
