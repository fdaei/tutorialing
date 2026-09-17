import { ReceiptTopUpsService } from './receipt-top-ups.service';

function harness(
  opts: {
    file?: Record<string, unknown> | null;
    payment?: Record<string, unknown> | null;
    claimed?: number;
    course?: Record<string, unknown> | null;
    enrolled?: boolean;
  } = {},
) {
  const db = {
    payment: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) =>
        Promise.resolve(where.id ? (opts.payment ?? null) : null),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(data)),
      updateMany: jest.fn().mockResolvedValue({ count: opts.claimed ?? 1 }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    storedFile: {
      findFirst: jest.fn().mockResolvedValue(
        opts.file === undefined ? { id: 'file-1', _count: { paymentReceipts: 0 } } : opts.file,
      ),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    course: { findFirst: jest.fn().mockResolvedValue(opts.course === undefined ? { id: 'course-1', price: 900_000 } : opts.course) },
    courseEnrollment: { findUnique: jest.fn().mockResolvedValue(opts.enrolled ? { id: 'e-1' } : null) },
  };
  const payments = {
    settleVerified: jest.fn().mockResolvedValue({ id: 'p-1', status: 'PAID' }),
    failPayment: jest.fn().mockResolvedValue({ id: 'p-1', status: 'FAILED' }),
  };
  return { db, payments, svc: new ReceiptTopUpsService(db as never, payments as never) };
}

const pending = { id: 'p-1', userId: 'student-1', status: 'PENDING', receiptFileId: 'file-1' };

describe('ReceiptTopUpsService', () => {
  it('creates a PENDING wallet top-up bound to the uploaded receipt', async () => {
    const h = harness();
    const payment = await h.svc.submit('student-1', { amount: 500_000, receiptFileId: 'file-1', idempotencyKey: 'k1' });
    expect(payment).toMatchObject({ purpose: 'wallet_top_up', status: 'PENDING', amount: 500_000, receiptFileId: 'file-1' });
    expect(h.db.storedFile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'student-1', status: 'SAFE' }) }),
    );
  });

  it('refuses a receipt the user does not own', async () => {
    const h = harness({ file: null });
    await expect(
      h.svc.submit('student-1', { amount: 500_000, receiptFileId: 'x', idempotencyKey: 'k1' }),
    ).rejects.toMatchObject({ response: { code: 'RECEIPT_FILE_NOT_FOUND' } });
  });

  it('refuses re-using a receipt for a second top-up', async () => {
    const h = harness({ file: { id: 'file-1', _count: { paymentReceipts: 1 } } });
    await expect(
      h.svc.submit('student-1', { amount: 500_000, receiptFileId: 'file-1', idempotencyKey: 'k2' }),
    ).rejects.toMatchObject({ response: { code: 'RECEIPT_ALREADY_SUBMITTED' } });
    expect(h.db.payment.create).not.toHaveBeenCalled();
  });

  it('approval settles through settleVerified', async () => {
    const h = harness({ payment: pending });
    await h.svc.approve('admin-1', 'p-1', 'BANK-42');
    expect(h.payments.settleVerified).toHaveBeenCalledWith('p-1', 'BANK-42', expect.anything());
  });

  it('rejection fails the payment and never credits', async () => {
    const h = harness({ payment: pending });
    await h.svc.reject('admin-1', 'p-1', 'مبلغ مطابقت ندارد');
    expect(h.payments.failPayment).toHaveBeenCalledWith('p-1', expect.anything());
    expect(h.payments.settleVerified).not.toHaveBeenCalled();
  });

  it('only one reviewer can act on a receipt', async () => {
    const h = harness({ payment: pending, claimed: 0 });
    await expect(h.svc.approve('admin-1', 'p-1')).rejects.toMatchObject({ response: { code: 'RECEIPT_ALREADY_REVIEWED' } });
    expect(h.payments.settleVerified).not.toHaveBeenCalled();
  });

  it('an admin cannot approve their own receipt', async () => {
    const h = harness({ payment: { ...pending, userId: 'admin-1' } });
    await expect(h.svc.approve('admin-1', 'p-1')).rejects.toMatchObject({
      response: { code: 'RECEIPT_SELF_REVIEW_FORBIDDEN' },
    });
  });

  it('a course receipt is charged the course price, not the client amount', async () => {
    const h = harness();
    const payment = await h.svc.submit('student-1', {
      amount: 1,
      receiptFileId: 'file-1',
      idempotencyKey: 'k3',
      courseId: 'course-1',
    });
    expect(payment).toMatchObject({ purpose: 'course', referenceId: 'course-1', amount: 900_000 });
  });

  it('refuses a course receipt when already enrolled', async () => {
    const h = harness({ enrolled: true });
    await expect(
      h.svc.submit('student-1', { amount: 0, receiptFileId: 'file-1', idempotencyKey: 'k4', courseId: 'course-1' }),
    ).rejects.toMatchObject({ response: { code: 'COURSE_ALREADY_ENROLLED' } });
  });

  it('refuses a wallet top-up below the minimum', async () => {
    const h = harness();
    await expect(
      h.svc.submit('student-1', { amount: 500, receiptFileId: 'file-1', idempotencyKey: 'k5' }),
    ).rejects.toMatchObject({ response: { code: 'RECEIPT_AMOUNT_TOO_LOW' } });
  });
});
