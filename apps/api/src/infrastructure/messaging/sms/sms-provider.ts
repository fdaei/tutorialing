export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export type SmsLookupRequest = {
  phone: string;
  template: string;
  tokens: readonly [string, string?];
};

export type SmsProviderResult = {
  providerId: string;
  response: object;
};

export interface SmsProvider {
  readonly configured: boolean;
  sendLookup(request: SmsLookupRequest): Promise<SmsProviderResult>;
}

export type SmsProviderFailureCode = 'NOT_CONFIGURED' | 'TIMEOUT' | 'NETWORK_ERROR' | 'REJECTED' | 'INVALID_RESPONSE';

export class SmsProviderError extends Error {
  constructor(
    readonly code: SmsProviderFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SmsProviderError';
  }
}
