import { BadGatewayException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { paymentConfig } from '../../../config/payment.config';
type ZarinpalResponse = {
  data?: { authority?: string; code?: number; ref_id?: number | string; message?: string };
  errors?: unknown;
};
// All LingoSpeak prices and ledger entries are stored in toman, while Zarinpal
// v4 accepts and verifies amounts in rial. Keep the conversion at this provider
// boundary so the rest of the finance domain stays in one unit.
const toRial = (toman: number) => toman * 10;

@Injectable()
export class GatewayService {
  async request(amount: number, description: string, callbackUrl: string) {
    const { webUrl, merchantId, apiBase, startBase } = paymentConfig();
    if (!merchantId) {
      const authority = `dev_${randomUUID()}`;
      return { authority, url: `${webUrl}/payment/development?authority=${authority}` };
    }
    const response = await this.send(`${apiBase}/pg/v4/payment/request.json`, {
      merchant_id: merchantId,
      amount: toRial(amount),
      description,
      callback_url: callbackUrl,
    });
    const body = await this.body(response);
    const authority = body.data?.authority;
    if (!response.ok || body.data?.code !== 100 || !authority)
      throw new BadGatewayException('Zarinpal payment request failed');
    return { authority, url: `${startBase}/pg/StartPay/${authority}` };
  }

  // Reconstructs the same redirect URL `request()` would have returned for an
  // authority it already issued, so a payment that already has one can be
  // resumed without opening a second Zarinpal session for the same payment.
  resumeUrl(authority: string) {
    const { webUrl, startBase } = paymentConfig();
    if (authority.startsWith('dev_')) return `${webUrl}/payment/development?authority=${authority}`;
    return `${startBase}/pg/StartPay/${authority}`;
  }

  async verify(authority: string, amount: number) {
    const { merchantId, apiBase } = paymentConfig();
    if (authority.startsWith('dev_') && !merchantId)
      return { ok: true, reference: `DEV-${createHash('sha1').update(authority).digest('hex').slice(0, 12)}` };
    if (!merchantId) return { ok: false };
    const response = await this.send(`${apiBase}/pg/v4/payment/verify.json`, {
      merchant_id: merchantId,
      amount: toRial(amount),
      authority,
    });
    const body = await this.body(response);
    const ok = response.ok && [100, 101].includes(body.data?.code ?? 0);
    return { ok, ...(ok && body.data?.ref_id != null ? { reference: String(body.data.ref_id) } : {}) };
  }

  /**
   * Every Zarinpal call goes through here so neither can be left without a
   * deadline. A gateway that accepts the connection and then never answers used
   * to hold the request open indefinitely — on `verify` that is worse than a
   * refusal, because the caller is a payment callback and the money has already
   * moved.
   *
   * Deliberately no retry. `request` and `verify` are not safe to replay blind:
   * a retried `request` opens a second gateway session for one payment, and a
   * retried `verify` re-attempts a capture whose outcome we do not know. The
   * repair path for a lost verify already exists and is deliberate —
   * `ReconciliationService` re-verifies stale settleable payments and settles
   * them through the same code a real callback uses.
   */
  private async send(url: string, payload: object) {
    const { providerTimeoutMs } = paymentConfig();
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(providerTimeoutMs),
      });
    } catch (error) {
      // `AbortSignal.timeout` rejects with a `TimeoutError`; a DNS or socket
      // failure arrives as a `TypeError`. Both are normalised to the same 502
      // the rest of this class raises, so callers see one gateway failure mode
      // rather than a raw undici error escaping as a 500.
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new BadGatewayException(
        timedOut ? `Zarinpal did not respond within ${providerTimeoutMs}ms` : 'Zarinpal request failed',
      );
    }
  }

  private async body(response: Response) {
    try {
      return (await response.json()) as ZarinpalResponse;
    } catch {
      throw new BadGatewayException('Zarinpal returned an invalid response');
    }
  }
}
