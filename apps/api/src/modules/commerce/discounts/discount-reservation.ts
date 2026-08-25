import type { Tx } from '../../../infrastructure/database/prisma.service';

/**
 * Gives back the discount use that `createPayment` reserved when the payment
 * was created. Without this, every abandoned or failed checkout permanently
 * consumed one of the code's `maxUses`, so a limited code would stop working
 * long before it had actually been redeemed that many times.
 *
 * Callers must only invoke this once per payment — both call sites reach it
 * only while the payment is still PENDING and immediately move it to a terminal
 * status in the same transaction, so a redelivered callback or a retried job
 * cannot double-release. The `usedCount: { gt: 0 }` filter is a floor, not the
 * primary guard: it keeps a bad release from driving the counter negative.
 */
export async function releaseDiscount(tx: Tx, discountId: string | null) {
  if (!discountId) return;
  await tx.discount.updateMany({
    where: { id: discountId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}
