import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

test('sequential student teacher admin flow in three visible tabs', async ({ browser }) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
  const context = await browser.newContext();
  const adminPermissions = ['users.read', 'users.manage', 'teachers.read', 'teachers.verify', 'teacher-prices.manage', 'languages.manage', 'tests.manage', 'tests.review', 'bookings.read', 'bookings.manage', 'tickets.read', 'tickets.manage', 'payments.read', 'payments.refund', 'payments.adjust-wallet', 'payouts.manage', 'reviews.manage', 'courses.manage', 'audit.read', 'settings.manage', 'cms.manage', 'notifications.read', 'roles.manage', 'reports.read', 'availability.manage'];
  const make = async (id: string, roles: string[], path: string) => {
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    page.on('response', (response) => {
      if (response.url().includes('/api/')) console.log(`${id}: ${response.status()} ${response.request().method()} ${response.url()}`);
    });
    const token = jwt.sign({ id, roles, permissions: roles.includes('ADMIN') ? adminPermissions : [] }, secret, { expiresIn: '2h' });
    await page.addInitScript((value) => sessionStorage.setItem('access_token', value), token);
    await page.goto(path, { waitUntil: 'commit' });
    await page.waitForTimeout(2500);
    console.log(`${id}: loaded ${page.url()} title=${await page.title()}`);
    return page;
  };
  const teacher = await make('user-teacher-shahriar', ['INSTRUCTOR'], '/teacher-panel/courses');
  await expect(teacher).toHaveURL(/teacher-panel\/courses/);
  await teacher.screenshot({ path: 'test-results/sequential-01-teacher.png', fullPage: true });

  const admin = await make('user-admin', ['ADMIN'], '/admin/finance');
  await expect(admin).toHaveURL(/admin\/finance/);
  await admin.screenshot({ path: 'test-results/sequential-02-admin-finance.png', fullPage: true });

  const student = await make('user-student-completed', ['STUDENT'], '/dashboard/classes');
  await expect(student).toHaveURL(/dashboard\/classes/);
  await student.screenshot({ path: 'test-results/sequential-03-student-calendar.png', fullPage: true });
  await student.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
  await expect(student).toHaveURL(/dashboard\/notifications/);
  await student.screenshot({ path: 'test-results/sequential-04-student-notifications.png', fullPage: true });
  await student.bringToFront();
  await student.pause();
});
