import { test } from '@playwright/test';
import jwt from 'jsonwebtoken';

test('open student teacher admin tabs', async ({ browser }) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
  const roles = [
    { name: 'student', id: 'user-student-completed', roles: ['STUDENT'], path: '/dashboard/classes' },
    { name: 'teacher', id: 'user-teacher-shahriar', roles: ['INSTRUCTOR'], path: '/teacher-panel/courses' },
    { name: 'admin', id: 'user-admin', roles: ['ADMIN'], path: '/admin' },
  ] as const;
  const context = await browser.newContext();
  const pages = await Promise.all(roles.map(async (role) => {
    const page = await context.newPage();
    const token = jwt.sign({ id: role.id, roles: role.roles, permissions: ['payments.read', 'payments.adjust-wallet', 'bookings.read', 'courses.manage'] }, secret, { expiresIn: '2h' });
    await page.addInitScript((value) => sessionStorage.setItem('access_token', value), token);
    await page.goto(role.path, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: `test-results/roles-${role.name}.png`, fullPage: true });
    console.log(`${role.name}: ${page.url()}`);
    return page;
  }));
  await pages[0].bringToFront();
  await pages[0].pause();
});
