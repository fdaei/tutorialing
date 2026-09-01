import { api } from '@/shared/services/api';
export type Wallet = {
  balance: number;
  reservedCredit?: number;
  successfulPaymentsTotal?: number;
  classesSpentTotal?: number;
  updatedAt?: string;
};
export type Transaction = {
  id: string;
  title: string;
  type: 'TOP_UP' | 'CLASS_PURCHASE' | 'BOOKING' | 'REFUND' | 'DISCOUNT' | 'GIFT' | 'ADJUSTMENT';
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceAfter: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
  trackingId: string;
  paymentMethod?: string;
};
export type Invoice = {
  id: string;
  number: string;
  title: string;
  amount: number;
  status: string;
  createdAt: string;
  downloadUrl?: string;
};
export type PaymentRequest = { amount: number; gateway: string; discountCode?: string };
const invoiceTitle = (purpose: string) => {
  switch (purpose.toLowerCase()) {
    case 'booking':
      return 'پرداخت کلاس';
    case 'package':
      return 'پرداخت بسته آموزشی';
    case 'wallet_top_up':
      return 'افزایش موجودی کیف پول';
    default:
      return 'پرداخت';
  }
};
export const walletService = {
  getWallet: () => api<Wallet>('/payments/wallet'),
  getTransactions: async (): Promise<Transaction[]> => {
    const rows = await api<
      Array<{
        id: string;
        description: string;
        referenceType: string;
        direction: 'CREDIT' | 'DEBIT';
        amount: number;
        balanceAfter: number;
        status: 'SUCCESS';
        createdAt: string;
        transactionId: string;
      }>
    >('/payments/wallet/transactions');
    return rows.map((row) => ({
      id: row.id,
      title: row.description,
      type: row.referenceType === 'Refund' ? 'REFUND' : row.direction === 'CREDIT' ? 'TOP_UP' : 'CLASS_PURCHASE',
      direction: row.direction,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      status: row.status,
      createdAt: row.createdAt,
      trackingId: row.transactionId,
      paymentMethod: 'کیف پول',
    }));
  },
  getInvoices: async (): Promise<Invoice[]> => {
    const rows = await api<
      Array<{
        id: string;
        purpose: string;
        amount: number;
        status: string;
        createdAt: string;
        gatewayReference?: string;
      }>
    >('/payments/invoices');
    return rows.map((row) => ({
      id: row.id,
      number: row.gatewayReference ?? row.id,
      title: invoiceTitle(row.purpose),
      amount: row.amount,
      status: row.status,
      createdAt: row.createdAt,
    }));
  },
  topUp: async (request: PaymentRequest) => {
    return api<{ paymentId: string; status: string; url?: string }>('/payments/wallet/top-up', {
      method: 'POST',
      body: JSON.stringify({
        amount: request.amount,
        discountCode: request.discountCode,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
  },
};
