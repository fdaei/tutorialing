import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

test('visual student sees approved live course and enrollment CTA', async ({ page }) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
  const token = jwt.sign({ id: 'user-student-completed', roles: ['STUDENT'], permissions: [] }, secret, { expiresIn: '15m' });
  await page.addInitScript((value) => sessionStorage.setItem('access_token', value), token);
  const slug = 'e2e-live-course-1790715303832';
  const api: string[] = [];
  page.on('response', (r) => { if (r.url().includes('/api/')) api.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
  await page.goto(`/courses/${slug}`);
  await expect(page.locator('h1').filter({ hasText: 'دوره مکالمه سریع تستی' })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'test-results/student-course-01-approved.png', fullPage: true });
  const enroll = page.getByRole('link', { name: /مشاهده زمان‌های آزاد و پرداخت/ });
  const calendar = page.getByRole('link', { name: /مشاهده زمان جلسات/ });
  if (await enroll.isVisible().catch(() => false)) {
    await enroll.click();
    await expect(page.getByText('خرید دوره با رسید پرداخت')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'test-results/student-course-02-enrollment.png', fullPage: true });
    await page.locator('input[type="file"]').setInputFiles('public/images/teachers/shahriar-shahfar.png');
    await page.getByRole('button', { name: 'ثبت رسید' }).click();
    await expect(page.getByRole('status')).toContainText(/رسید ثبت شد|در انتظار تأیید/, { timeout: 15_000 });
    await page.screenshot({ path: 'test-results/student-course-03-receipt-submitted.png', fullPage: true });
  } else {
    await expect(calendar).toBeVisible({ timeout: 10_000 });
    await calendar.click();
    await expect(page).toHaveURL(/dashboard\/classes/);
    await page.screenshot({ path: 'test-results/student-course-04-enrolled-calendar.png', fullPage: true });
  }
  console.log(api.join('\n'));
});
