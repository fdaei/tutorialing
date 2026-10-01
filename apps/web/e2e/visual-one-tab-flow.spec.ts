import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

test('complete visible flow in one browser tab', async ({ page }) => {
  test.setTimeout(120_000);
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
  page.setDefaultNavigationTimeout(30_000);
  page.on('response', (r) => { if (r.url().includes('/api/')) console.log(`${r.status()} ${r.request().method()} ${r.url()}`); });
  const permissions = ['users.read','users.manage','teachers.read','teachers.verify','teacher-prices.manage','languages.manage','tests.manage','tests.review','bookings.read','bookings.manage','tickets.read','tickets.manage','payments.read','payments.refund','payments.adjust-wallet','payouts.manage','reviews.manage','courses.manage','audit.read','settings.manage','cms.manage','notifications.read','roles.manage','reports.read','availability.manage'];
  async function switchRole(id: string, roles: string[], path: string) {
    const token = jwt.sign({ id, roles, permissions: roles.includes('ADMIN') ? permissions : [] }, secret, { expiresIn: '2h' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((value) => sessionStorage.setItem('access_token', value), token);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4_000);
  }
  await switchRole('user-teacher-shahriar', ['INSTRUCTOR'], '/teacher-panel/courses');
  await page.screenshot({ path: 'test-results/one-tab-01-teacher.png', fullPage: true });
  await page.waitForTimeout(5_000);
  await switchRole('user-admin', ['ADMIN'], '/admin/courses');
  await page.screenshot({ path: 'test-results/one-tab-02-admin-course.png', fullPage: true });
  await page.waitForTimeout(5_000);
  await page.goto('/admin/teacher-prices', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: 'test-results/one-tab-03-admin-prices.png', fullPage: true });
  await page.goto('/admin/finance', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: 'test-results/one-tab-04-admin-finance.png', fullPage: true });
  await page.waitForTimeout(5_000);
  await switchRole('user-student-completed', ['STUDENT'], '/courses/e2e-live-course-1790715303832');
  await page.screenshot({ path: 'test-results/one-tab-05-student-course.png', fullPage: true });
  await page.goto('/dashboard/classes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3_000);
  await expect(page.getByRole('link', { name: /Google Meet/ })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'test-results/one-tab-06-calendar.png', fullPage: true });
  await page.getByRole('link', { name: /Google Meet/ }).click({ noWaitAfter: true });
  await page.waitForTimeout(3_000);
  await page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: 'test-results/one-tab-07-notifications.png', fullPage: true });
  expect(true).toBeTruthy();
});
