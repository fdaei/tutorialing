/**
 * The public surface of the commerce module.
 *
 * Other modules import from here, never from a path inside `payments/`,
 * `payouts/`, `packages/` or `discounts/`. Before this barrel existed, `queue`
 * reached into `commerce/discounts/discount-reservation` and `bookings` into
 * `commerce/payouts/earnings.service`, so moving either file — as the `3b04c00`
 * restructure did move them — silently broke two unrelated modules (STR-202).
 *
 * Anything added here is a promise to other modules. Keep it small.
 */
export { EarningsService } from './payouts/earnings.service';
export { WalletService } from './payments/wallet.service';
export { AutoDiscountsService } from './discounts/auto-discounts.service';
export { releaseDiscount } from './discounts/discount-reservation';
