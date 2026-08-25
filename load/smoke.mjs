// smoke.js — 1 VU sanity walk of the golden path: login -> browse -> book a
// trial lesson -> pay (dev gateway fallback) -> assert booking confirmed.
// Run: node load/smoke.mjs   (API must be running locally, see AUDIT/05-load.md)
import { api, loginWithOtp, authed, assert, SEED } from './lib/client.mjs';

async function main() {
  const health = await api('/health');
  assert(health.status === 200, `health check: ${health.status}`);

  const randomPhone = `09${String(Math.floor(100000000 + Math.random() * 899999999))}`;
  const session = await loginWithOtp(randomPhone);
  const call = authed(session.accessToken);
  console.log(`logged in as ${session.user.phone} (${session.user.id})`);

  const teacher = await api(`/teachers/${SEED.teacherSlug}`);
  assert(teacher.status === 200, `teacher lookup: ${teacher.status}`);

  const from = new Date(Date.now() + 24 * 3600e3).toISOString();
  const to = new Date(Date.now() + 6 * 24 * 3600e3).toISOString();
  const slots = await api(`/availability/${teacher.body.id}/slots?from=${from}&to=${to}&type=trial`);
  assert(slots.status === 200 && slots.body.length > 0, `no slots returned: ${slots.status}`);
  const slot = slots.body[Math.floor(Math.random() * slots.body.length)];

  const booking = await call('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      teacherId: teacher.body.id,
      startsAt: slot.startsAt,
      type: 'trial',
      policyAccepted: true,
      timezone: 'Asia/Tehran',
    }),
  });
  assert(booking.status === 201, `booking create: ${booking.status} ${JSON.stringify(booking.body)}`);
  console.log(`booked ${slot.startsAt}, booking ${booking.body.id}, status ${booking.body.status}`);

  const payment = await call('/payments', {
    method: 'POST',
    body: JSON.stringify({
      purpose: 'booking',
      referenceId: booking.body.id,
      walletAmount: 0,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  assert(payment.status === 201, `payment create: ${payment.status} ${JSON.stringify(payment.body)}`);
  console.log(`payment ${payment.body.id}, status ${payment.body.status}, amount ${payment.body.gatewayAmount}`);

  const gw = await call(`/payments/${payment.body.id}/gateway`, { method: 'POST' });
  assert(gw.status === 201 || gw.status === 200, `gateway redirect: ${gw.status} ${JSON.stringify(gw.body)}`);
  assert(gw.body.authority?.startsWith('dev_'), `expected dev fallback authority, got ${gw.body.authority}`);
  console.log(`gateway authority ${gw.body.authority}`);

  const cb = await api(`/payments/callback?Authority=${gw.body.authority}&Status=OK`);
  assert(cb.status === 200, `callback: ${cb.status} ${JSON.stringify(cb.body)}`);
  console.log(`callback result: ${JSON.stringify(cb.body)}`);

  const mine = await call('/bookings/me');
  const confirmed = mine.body.find((b) => b.id === booking.body.id);
  assert(confirmed?.status === 'CONFIRMED', `expected CONFIRMED, got ${confirmed?.status}`);
  console.log('SMOKE PASS: booking confirmed end-to-end via dev-gateway happy path');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
