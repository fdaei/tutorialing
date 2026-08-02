import { Logger } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';

// The provider-unreachable and repair-failed cases below log deliberately;
// without this their expected output drowns out real failures.
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());

const PAYMENT = { id: 'payment-1', status: 'PENDING', authority: 'A0000000000000000000000000000001', gatewayAmount: 250_000 };

function harness(options: { candidates?: Record<string, unknown>[]; verify?: unknown; open?: Record<string, unknown> | null; settleError?: unknown } = {}) {
  const created: Record<string, unknown>[] = [];
  const db = {
    payment: { findMany: jest.fn().mockResolvedValue(options.candidates ?? [PAYMENT]) },
    reconciliation: {
      findFirst: jest.fn().mockResolvedValue(options.open ?? null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve({ id: 'rec-1', ...data });
      }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'rec-1', ...data })),
    },
  };
  const redis = { lock: jest.fn().mockResolvedValue({ token: 't', release: jest.fn() }) };
  const gateway = { verify: jest.fn().mockResolvedValue(options.verify ?? { ok: false }) };
  const payments = {
    settleVerified: jest.fn().mockImplementation(() =>
      options.settleError ? Promise.reject(options.settleError) : Promise.resolve({ id: PAYMENT.id, status: 'PAID', bookingId: null })),
  };
  const svc = new ReconciliationService(db as never, redis as never, gateway as never, payments as never);
  return { svc, db, redis, gateway, payments, created };
}

describe('ReconciliationService', () => {
  // FIN-005: the gap is a capture Zarinpal kept but we never recorded, because
  // the process died between verify() and the commit.
  it('flags and repairs a payment the provider confirms but the database does not', async () => {
    const h = harness({ verify: { ok: true, reference: 'REF-1' } });
    const summary = await h.svc.reconcile();
    expect(summary).toMatchObject({ checked: 1, mismatched: 1, repaired: 1, unrepaired: 0 });
    expect(h.created[0]).toMatchObject({ paymentId: PAYMENT.id, providerAmount: PAYMENT.gatewayAmount, matched: false });
    expect(h.payments.settleVerified).toHaveBeenCalledWith(PAYMENT.id, 'REF-1', expect.objectContaining({ source: 'reconciliation' }));
    expect(h.db.reconciliation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ matched: true }) }));
  });

  // Writing a row for every agreeing payment on every sweep would bury the real
  // mismatches under thousands of no-ops.
  it('writes nothing when the provider agrees no capture happened', async () => {
    const h = harness({ verify: { ok: false } });
    const summary = await h.svc.reconcile();
    expect(summary).toMatchObject({ checked: 1, mismatched: 0, repaired: 0 });
    expect(h.db.reconciliation.create).not.toHaveBeenCalled();
    expect(h.payments.settleVerified).not.toHaveBeenCalled();
  });

  // With no merchant id configured, gateway.verify() auto-approves `dev_`
  // authorities so the local payment simulator works — sweeping them would
  // silently fulfil every abandoned checkout in a development database.
  it('never settles a development authority', async () => {
    const h = harness({ candidates: [{ ...PAYMENT, authority: 'dev_abc' }], verify: { ok: true } });
    const summary = await h.svc.reconcile();
    expect(summary).toMatchObject({ mismatched: 0 });
    expect(h.gateway.verify).not.toHaveBeenCalled();
    expect(h.payments.settleVerified).not.toHaveBeenCalled();
  });

  // An unreachable provider is not evidence of a match; the payment has to stay
  // a candidate rather than be silently written off as reconciled.
  it('records nothing when the provider call fails', async () => {
    const h = harness();
    h.gateway.verify.mockRejectedValue(new Error('gateway down'));
    const summary = await h.svc.reconcile();
    expect(summary).toMatchObject({ checked: 1, mismatched: 0 });
    expect(h.db.reconciliation.create).not.toHaveBeenCalled();
  });

  it('keeps the row open and counts it unrepaired when settlement fails', async () => {
    const h = harness({ verify: { ok: true, reference: 'REF-1' }, settleError: new Error('commit failed') });
    const summary = await h.svc.reconcile();
    expect(summary).toMatchObject({ mismatched: 1, repaired: 0, unrepaired: 1 });
    expect(h.db.reconciliation.update).not.toHaveBeenCalled();
  });

  // A mismatch surviving several sweeps is still one incident; duplicating it
  // per run would make the table useless for seeing the real backlog.
  it('reuses the open row instead of creating one per sweep', async () => {
    const h = harness({ verify: { ok: true, reference: 'REF-1' }, open: { id: 'rec-existing', matched: false } });
    await h.svc.reconcile();
    expect(h.db.reconciliation.create).not.toHaveBeenCalled();
    expect(h.db.reconciliation.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'rec-existing' } }));
  });

  // Only settleable, stale, authority-bearing payments are candidates: anything
  // younger may be a user still on the gateway page.
  it('scopes candidates to stale settleable payments that reached the gateway', async () => {
    const h = harness();
    await h.svc.reconcile(new Date('2026-08-01T12:00:00Z'));
    const where = h.db.payment.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['PENDING', 'EXPIRED', 'FAILED'] });
    expect(where.authority).toEqual({ not: null });
    expect(where.updatedAt.lt).toEqual(new Date('2026-08-01T11:45:00Z'));
  });
});

describe('ReconciliationService.sweep', () => {
  // @Cron fires in every process; without the lock two instances would verify
  // and settle the same payment concurrently.
  it('does nothing when another instance holds the lock', async () => {
    const h = harness({ verify: { ok: true } });
    h.redis.lock.mockResolvedValue(null);
    await h.svc.sweep();
    expect(h.db.payment.findMany).not.toHaveBeenCalled();
  });

  it('releases the lock even when the sweep throws', async () => {
    const release = jest.fn();
    const h = harness();
    h.redis.lock.mockResolvedValue({ token: 't', release });
    h.db.payment.findMany.mockRejectedValue(new Error('db down'));
    await expect(h.svc.sweep()).rejects.toThrow('db down');
    expect(release).toHaveBeenCalled();
  });

  // Redis being unavailable must not take the API process down with it.
  it('skips the sweep when the lock cannot be taken', async () => {
    const h = harness();
    h.redis.lock.mockRejectedValue(new Error('redis down'));
    await expect(h.svc.sweep()).resolves.toBeUndefined();
    expect(h.db.payment.findMany).not.toHaveBeenCalled();
  });
});
