import { expect, test, type Page } from '@playwright/test';
import jwt from 'jsonwebtoken';

const permissions = [
  'users.read',
  'users.manage',
  'teachers.read',
  'teachers.verify',
  'teacher-prices.manage',
  'languages.manage',
  'tests.manage',
  'tests.review',
  'bookings.read',
  'bookings.manage',
  'tickets.read',
  'tickets.manage',
  'payments.read',
  'payments.refund',
  'payouts.manage',
  'reviews.manage',
  'audit.read',
  'settings.manage',
  'cms.manage',
  'notifications.read',
  'roles.manage',
  'reports.read',
  'availability.manage',
];

function session(page: Page, id: string, roles: string[], granted: string[] = []) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required for panel E2E tests');
  const token = jwt.sign({ id, roles, permissions: granted }, secret, { expiresIn: '15m' });
  return page.addInitScript((value) => sessionStorage.setItem('access_token', value), token);
}

function failures(page: Page) {
  const found: string[] = [];
  page.on('pageerror', (error) => found.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) found.push(`${response.status()} ${response.url()}`);
  });
  return found;
}

async function visit(page: Page, routes: string[]) {
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator('body'), route).not.toContainText('Internal Server Error');
    await expect(page.locator('main').first(), route).toBeVisible();
    await page.waitForLoadState('networkidle');
  }
}

test('student panel routes and data widgets render', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = failures(page);
  await session(page, 'user-student-completed', ['STUDENT']);
  await visit(page, [
    '/dashboard',
    '/dashboard/plan',
    '/dashboard/classes',
    '/dashboard/matches',
    '/dashboard/tests',
    '/dashboard/tickets',
    '/dashboard/wallet',
    '/dashboard/profile',
  ]);
  expect(errors).toEqual([]);
});

test('teacher panel routes and data widgets render', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = failures(page);
  await session(page, 'user-teacher-approved', ['TEACHER']);
  await visit(page, [
    '/teacher-panel',
    '/teacher-panel/profile',
    '/teacher-panel/availability',
    '/teacher-panel/classes',
    '/teacher-panel/students',
    '/teacher-panel/earnings',
    '/teacher-panel/more',
    '/teacher-panel/plans',
    '/teacher-panel/tickets',
    '/teacher-panel/reviews',
    '/teacher-panel/notifications',
    '/teacher-panel/settings',
  ]);
  expect(errors).toEqual([]);
});

test('administrator can render every administration feature', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = failures(page);
  await session(page, 'user-admin', ['ADMIN'], permissions);
  await visit(page, [
    '/admin',
    '/admin/search',
    '/admin/users',
    '/admin/teachers',
    '/admin/teacher-applications',
    '/admin/teacher-documents',
    '/admin/teacher-prices',
    '/admin/languages',
    '/admin/countries',
    '/admin/tests',
    '/admin/test-reviews',
    '/admin/bookings',
    '/admin/availability-blocks',
    '/admin/tickets',
    '/admin/finance',
    '/admin/payments',
    '/admin/discounts',
    '/admin/refunds',
    '/admin/teacher-earnings',
    '/admin/payouts',
    '/admin/reviews',
    '/admin/roles',
    '/admin/cms',
    '/admin/magazine',
    '/admin/notifications',
    '/admin/audit',
    '/admin/settings',
  ]);
  expect(errors).toEqual([]);
});

test('specialized staff are restricted to their permitted workspaces', async ({ page }) => {
  await session(page, 'user-support', ['SUPPORT'], ['tickets.read', 'tickets.manage']);
  await page.goto('/admin/tickets');
  await expect(page.getByText('پنل پشتیبانی').first()).toBeVisible();
  await page.goto('/admin/users');
  await expect(page.getByText('دسترسی مجاز نیست')).toBeVisible();

  await page.evaluate(() => sessionStorage.clear());
  await session(page, 'user-finance', ['SUPPORT'], ['teacher-prices.manage', 'payouts.manage', 'payments.refund']);
  await page.goto('/admin/payouts');
  await expect(page.getByText('پنل مالی').first()).toBeVisible();

  await page.evaluate(() => sessionStorage.clear());
  await session(page, 'user-examiner', ['SUPPORT'], ['tests.review']);
  await page.goto('/admin/test-reviews');
  await expect(page.getByText('پنل ارزیابی آزمون').first()).toBeVisible();
});
