import { RefundsService } from './refunds.service';

function harness(payment: Record<string, unknown>) {
  const tx = {
    refund: {
      findUnique: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'refund-1', ...data })),
    },
    payment: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const db = { $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)) };
  const wallet = { ledger: jest.fn() };
  const svc = new RefundsService(db as never, wallet as never);
  return { svc, tx, wallet };
}

describe('RefundsService.refund', () => {
  it('rejects a refund on a payment that was never captured (PENDING)', async () => {
    const h = harness({ id: 'payment-1', status: 'PENDING', amount: 100_000, userId: 'user-1' });
    await expect(h.svc.refund('admin-1', 'payment-1', 50_000, 'test', 'key-1')).rejects.toMatchObject({
      response: { code: 'PAYMENT_NOT_REFUNDABLE' },
    });
    expect(h.tx.payment.update).not.toHaveBeenCalled();
    expect(h.wallet.ledger).not.toHaveBeenCalled();
  });

  it('rejects a refund on a payment that already failed', async () => {
    const h = harness({ id: 'payment-1', status: 'FAILED', amount: 100_000, userId: 'user-1' });
    await expect(h.svc.refund('admin-1', 'payment-1', 50_000, 'test', 'key-1')).rejects.toMatchObject({
      response: { code: 'PAYMENT_NOT_REFUNDABLE' },
    });
  });

  it('allows a refund on a PAID payment', async () => {
    const h = harness({ id: 'payment-1', status: 'PAID', amount: 100_000, userId: 'user-1' });
    const refund = await h.svc.refund('admin-1', 'payment-1', 100_000, 'test', 'key-1');
    expect(refund).toMatchObject({ amount: 100_000 });
    expect(h.tx.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-1' }, data: { status: 'REFUNDED' } });
  });

  it('allows a further refund on a PARTIALLY_REFUNDED payment', async () => {
    const h = harness({ id: 'payment-1', status: 'PARTIALLY_REFUNDED', amount: 100_000, userId: 'user-1' });
    h.tx.refund.aggregate.mockResolvedValue({ _sum: { amount: 40_000 } });
    const refund = await h.svc.refund('admin-1', 'payment-1', 60_000, 'test', 'key-2');
    expect(refund).toMatchObject({ amount: 60_000 });
    expect(h.tx.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-1' }, data: { status: 'REFUNDED' } });
  });
});
