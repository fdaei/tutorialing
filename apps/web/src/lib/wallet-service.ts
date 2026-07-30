import{api}from'./api';
export type Wallet={balance:number;reservedCredit?:number;successfulPaymentsTotal?:number;classesSpentTotal?:number;updatedAt?:string};
export type Transaction={id:string;title:string;type:'TOP_UP'|'CLASS_PURCHASE'|'BOOKING'|'REFUND'|'DISCOUNT'|'GIFT'|'ADJUSTMENT';direction:'CREDIT'|'DEBIT';amount:number;balanceAfter:number;status:'SUCCESS'|'FAILED'|'PENDING'|'CANCELLED'|'REFUNDED';createdAt:string;trackingId:string;paymentMethod?:string};
export type Invoice={id:string;number:string;title:string;amount:number;status:string;createdAt:string;downloadUrl?:string};
export type PaymentRequest={amount:number;gateway:string;discountCode?:string};
export const walletService={
 getWallet:()=>api<Wallet>('/payments/wallet'),
 // TODO(api): add GET /payments/wallet/transactions with filters and pagination.
 getTransactions:async():Promise<Transaction[]>=>[],
 // TODO(api): add GET /payments/invoices and authenticated invoice download URLs.
 getInvoices:async():Promise<Invoice[]>=>[],
 // TODO(api): add POST /payments/wallet/top-up. The existing POST /payments only accepts booking/package references.
 topUp:async(_request:PaymentRequest):Promise<never>=>{throw new Error('سرویس افزایش موجودی هنوز از سمت سرور فعال نشده است.');},
};
