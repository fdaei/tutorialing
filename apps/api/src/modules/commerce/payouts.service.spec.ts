import { Prisma } from '@prisma/client';
import { PayoutsService } from './payouts.service';

function harness(options: { balanceCredit?: number; balanceDebit?: number; pendingAmount?: number } = {}) {
  const tx = {
    walletEntry: {
      groupBy: jest.fn().mockResolvedValue([
        { direction: 'CREDIT', _sum: { amount: options.balanceCredit ?? 100_000 } },
        { direction: 'DEBIT', _sum: { amount: options.balanceDebit ?? 0 } },
      ]),
    },
    withdrawalRequest: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: options.pendingAmount ?? 0 } }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'withdrawal-1', status: 'PENDING', ...data })),
    },
  };
  const db = {
    teacher: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'teacher-1' }) },
    $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
  };
  const svc = new PayoutsService(db as never);
  return { svc, db, tx };
}

describe('PayoutsService.requestWithdrawal', () => {
  it('runs the balance-check transaction at Serializable isolation (FIN-003)', async () => {
    const h = harness();
    await h.svc.requestWithdrawal('user-1', 50_000, 'IR000000000000000000000000');
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });

  it('rejects a withdrawal above the available balance', async () => {
    const h = harness({ balanceCredit: 100_000, pendingAmount: 60_000 });
    await expect(h.svc.requestWithdrawal('user-1', 50_000, 'IR000000000000000000000000')).rejects.toMatchObject({
      response: { code: 'WITHDRAWAL_INSUFFICIENT_BALANCE' },
    });
    expect(h.tx.withdrawalRequest.create).not.toHaveBeenCalled();
  });

  it('allows a withdrawal within the available balance', async () => {
    const h = harness({ balanceCredit: 100_000, pendingAmount: 0 });
    const result = await h.svc.requestWithdrawal('user-1', 50_000, 'IR000000000000000000000000');
    expect(result).toMatchObject({ amount: 50_000 });
    expect(h.tx.withdrawalRequest.create).toHaveBeenCalled();
  });
});
