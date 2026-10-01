import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

test('guided visible multi-role course flow', async ({ browser }) => {
  test.setTimeout(180_000);
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
  const context = await browser.newContext();
  const adminPermissions = ['users.read','users.manage','teachers.read','teachers.verify','teacher-prices.manage','languages.manage','tests.manage','tests.review','bookings.read','bookings.manage','tickets.read','tickets.manage','payments.read','payments.refund','payments.adjust-wallet','payouts.manage','reviews.manage','courses.manage','audit.read','settings.manage','cms.manage','notifications.read','roles.manage','reports.read','availability.manage'];
  async function tab(id: string, roles: string[], path: string) {
    const page = await context.newPage();
    const token = jwt.sign({ id, roles, permissions: roles.includes('ADMIN') ? adminPermissions : [] }, secret, { expiresIn: '2h' });
    await page.addInitScript((value) => sessionStorage.setItem('access_token', value), token);
    page.on('response', (r) => { if (r.url().includes('/api/')) console.log(`${id}: ${r.status()} ${r.request().method()} ${r.url()}`); });
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(4_000);
    return page;
  }
  const teacher = await tab('teacher', ['INSTRUCTOR'], '/teacher-panel/courses');
  await teacher.screenshot({ path: 'test-results/guided-01-teacher-course.png', fullPage: true });
  await teacher.waitForTimeout(8_000);
  const admin = await tab('admin', ['ADMIN'], '/admin/courses');
  await admin.screenshot({ path: 'test-results/guided-02-admin-course-approval.png', fullPage: true });
  await admin.waitForTimeout(8_000);
  await admin.goto('/admin/teacher-prices', { waitUntil: 'domcontentloaded' });
  await admin.waitForTimeout(4_000);
  await admin.screenshot({ path: 'test-results/guided-03-admin-prices.png', fullPage: true });
  await admin.waitForTimeout(8_000);
  await admin.goto('/admin/finance', { waitUntil: 'domcontentloaded' });
  await admin.waitForTimeout(4_000);
  await admin.screenshot({ path: 'test-results/guided-04-admin-finance.png', fullPage: true });
  await admin.waitForTimeout(8_000);
  const student = await tab('student', ['STUDENT'], '/courses/e2e-live-course-1790715303832');
  await student.screenshot({ path: 'test-results/guided-05-student-course.png', fullPage: true });
  await student.waitForTimeout(8_000);
  await student.goto('/dashboard/classes', { waitUntil: 'domcontentloaded' });
  await student.waitForTimeout(4_000);
  await student.screenshot({ path: 'test-results/guided-06-student-calendar.png', fullPage: true });
  await student.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
  await student.waitForTimeout(4_000);
  await student.screenshot({ path: 'test-results/guided-07-student-notifications.png', fullPage: true });
  await student.bringToFront();
  // Keep the final state visible briefly, then finish instead of waiting on
  // Playwright Inspector's pause indefinitely.
  await student.waitForTimeout(15_000);
  expect(true).toBeTruthy();
});
