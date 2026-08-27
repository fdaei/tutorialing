import { Injectable, Logger } from '@nestjs/common';
import { config } from '../../../config';
import { SmsLookupRequest, SmsProvider, SmsProviderError, SmsProviderResult } from './sms-provider';

const maskPhone = (phone: string) => (phone.length < 7 ? '***' : `${phone.slice(0, 4)}***${phone.slice(-3)}`);

@Injectable()
export class KavenegarProvider implements SmsProvider {
  private readonly logger = new Logger(KavenegarProvider.name);
  private readonly cfg = config();

  get configured() {
    return Boolean(this.cfg.KAVENEGAR_API_KEY);
  }

  async sendLookup(request: SmsLookupRequest): Promise<SmsProviderResult> {
    if (!this.cfg.KAVENEGAR_API_KEY) throw new SmsProviderError('NOT_CONFIGURED', 'SMS provider is not configured');
    const startedAt = Date.now();
    const query = new URLSearchParams({
      receptor: request.phone,
      token: request.tokens[0],
      template: request.template,
    });
    if (request.tokens[1] !== undefined) query.set('token2', request.tokens[1]);

    try {
      const response = await fetch(
        `${this.cfg.KAVENEGAR_API_BASE}/v1/${this.cfg.KAVENEGAR_API_KEY}/verify/lookup.json?${query.toString()}`,
        { method: 'POST', signal: AbortSignal.timeout(this.cfg.PROVIDER_TIMEOUT_MS) },
      );
      let body: object;
      try {
        body = (await response.json()) as object;
      } catch (error) {
        throw new SmsProviderError('INVALID_RESPONSE', 'SMS provider returned an invalid response', { cause: error });
      }
      if (!response.ok) throw new SmsProviderError('REJECTED', 'SMS provider rejected the message');
      this.logger.log({
        event: 'sms.delivery',
        channel: 'SMS',
        provider: 'kavenegar',
        recipient: maskPhone(request.phone),
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return { providerId: `kavenegar-${Date.now()}`, response: body };
    } catch (error) {
      const normalized =
        error instanceof SmsProviderError
          ? error
          : error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
            ? new SmsProviderError('TIMEOUT', 'SMS provider timed out', { cause: error })
            : new SmsProviderError('NETWORK_ERROR', 'SMS provider request failed', { cause: error });
      this.logger.error({
        event: 'sms.delivery',
        channel: 'SMS',
        provider: 'kavenegar',
        recipient: maskPhone(request.phone),
        durationMs: Date.now() - startedAt,
        success: false,
        failureCode: normalized.code,
      });
      throw normalized;
    }
  }
}
