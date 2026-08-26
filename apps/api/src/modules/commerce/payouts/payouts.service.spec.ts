import { Prisma } from '@prisma/client';
import { PayoutsService } from './payouts.service';

const IBAN = 'IR000000000000000000000000';
const KEY = 'withdrawal-key-1';

function harness(options: { balanceCredit?: number; balanceDebit?: number; pendingAmount?: number; replay?: Record<string, unknown> | null; createError?: unknown } = {}) {
  const tx = {
    walletEntry: {
      groupBy: jest.fn().mockResolvedValue([
        { direction: 'CREDIT', _sum: { amount: options.balanceCredit ?? 100_000 } },
        { direction: 'DEBIT', _sum: { amount: options.balanceDebit ?? 0 } },
      ]),
    },
    withdrawalRequest: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: options.pendingAmount ?? 0 } }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        options.createError ? Promise.reject(options.createError) : Promise.resolve({ id: 'withdrawal-1', status: 'PENDING', ...data })),
    },
  };
  const db = {
    teacher: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'teacher-1' }) },
    withdrawalRequest: { findUnique: jest.fn().mockResolvedValue(options.replay ?? null) },
    $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => Promise.resolve().then(() => fn(tx))),
  };
  const svc = new PayoutsService(db as never);
  return { svc, db, tx };
}

const p2002 = Object.assign(new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '6' }), {});

describe('PayoutsService.approvePayout (PERF-305)', () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `item-${index}`,
    earningId: `earning-${index}`,
    teacherId: `teacher-${index % 3}`,
    amount: 10_000 + index,
  }));

  function approvalHarness(teachers = Array.from({ length: 3 }, (_, index) => ({ id: `teacher-${index}`, userId: `user-${index}` }))) {
    const tx = {
      payoutBatch: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'batch-1', status: 'DRAFT', items }),
        update: jest.fn().mockResolvedValue({ id: 'batch-1', status: 'TRANSFERRED' }),
      },
      earning: { updateMany: jest.fn().mockResolvedValue({ count: items.length }) },
      teacher: {
        findMany: jest.fn().mockResolvedValue(teachers),
        findUniqueOrThrow: jest.fn().mockRejectedValue(new Error('missing teacher')),
      },
      walletEntry: { createMany: jest.fn().mockResolvedValue({ count: items.length }) },
    };
    const db = { $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };
    return { service: new PayoutsService(db as never), tx };
  }

  it('batches teacher resolution and wallet debits instead of issuing two statements per item', async () => {
    const { service, tx } = approvalHarness();

    await service.approvePayout('batch-1', 'finance-1', 'bank-reference');

    expect(tx.teacher.findMany).toHaveBeenCalledTimes(1);
    expect(tx.teacher.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['teacher-0', 'teacher-1', 'teacher-2'] } },
      select: { id: true, userId: true },
    });
    expect(tx.teacher.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.walletEntry.createMany).toHaveBeenCalledTimes(1);
    expect(tx.walletEntry.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: 'user-0', referenceId: 'item-0', idempotencyKey: 'payout-debit:item-0' }),
      ]),
      skipDuplicates: true,
    });
  });

  it('preserves idempotency through unique keys and skipDuplicates', async () => {
    const { service, tx } = approvalHarness();

    await service.approvePayout('batch-1', 'finance-1', 'bank-reference');

    const data = tx.walletEntry.createMany.mock.calls[0][0].data;
    expect(new Set(data.map((row: { idempotencyKey: string }) => row.idempotencyKey)).size).toBe(items.length);
    expect(tx.walletEntry.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it('fails before creating debits when a payout item references a missing teacher', async () => {
    const { service, tx } = approvalHarness([{ id: 'teacher-0', userId: 'user-0' }]);

    await expect(service.approvePayout('batch-1', 'finance-1', 'bank-reference')).rejects.toThrow('missing teacher');

    expect(tx.teacher.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      select: { userId: true },
    });
    expect(tx.walletEntry.createMany).not.toHaveBeenCalled();
  });
});

describe('PayoutsService.requestWithdrawal', () => {
  it('runs the balance-check transaction at Serializable isolation (FIN-003)', async () => {
    const h = harness();
    await h.svc.requestWithdrawal('user-1', 50_000, IBAN, KEY);
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });

  it('rejects a withdrawal above the available balance', async () => {
    const h = harness({ balanceCredit: 100_000, pendingAmount: 60_000 });
    await expect(h.svc.requestWithdrawal('user-1', 50_000, IBAN, KEY)).rejects.toMatchObject({
      response: { code: 'WITHDRAWAL_INSUFFICIENT_BALANCE' },
    });
    expect(h.tx.withdrawalRequest.create).not.toHaveBeenCalled();
  });

  it('allows a withdrawal within the available balance', async () => {
    const h = harness({ balanceCredit: 100_000, pendingAmount: 0 });
    const result = await h.svc.requestWithdrawal('user-1', 50_000, IBAN, KEY);
    expect(result).toMatchObject({ amount: 50_000, idempotencyKey: KEY });
    expect(h.tx.withdrawalRequest.create).toHaveBeenCalled();
  });

  // FIN-004. Serializable isolation stops two concurrent withdrawals from
  // over-drawing the balance, but a double-click well within the balance is two
  // individually-valid requests; only the key collapses them.
  it('returns the original request when an idempotency key is replayed', async () => {
    const h = harness({ replay: { id: 'withdrawal-1', teacherId: 'teacher-1', amount: 50_000, idempotencyKey: KEY } });
    await expect(h.svc.requestWithdrawal('user-1', 50_000, IBAN, KEY)).resolves.toMatchObject({ id: 'withdrawal-1' });
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });

  it('re-reads the winner when two concurrent submits share a key', async () => {
    const h = harness({ createError: p2002 });
    h.db.withdrawalRequest.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'withdrawal-1', teacherId: 'teacher-1', amount: 50_000, idempotencyKey: KEY });
    await expect(h.svc.requestWithdrawal('user-1', 50_000, IBAN, KEY)).resolves.toMatchObject({ id: 'withdrawal-1' });
  });

  // A key is client-chosen, so guessing another teacher's key must not hand
  // back their withdrawal request.
  it('refuses a key already used by another teacher', async () => {
    const h = harness({ replay: { id: 'withdrawal-9', teacherId: 'teacher-other', amount: 50_000, idempotencyKey: KEY } });
    await expect(h.svc.requestWithdrawal('user-1', 50_000, IBAN, KEY)).rejects.toMatchObject({
      response: { code: 'WITHDRAWAL_KEY_CONFLICT' },
    });
  });
});
