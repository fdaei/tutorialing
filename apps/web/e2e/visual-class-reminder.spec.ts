import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

test('visual confirmed class, calendar link and reminder', async ({ page }) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
  const token = jwt.sign({ id: 'user-student-completed', roles: ['STUDENT'], permissions: [] }, secret, { expiresIn: '15m' });
  await page.addInitScript((value) => sessionStorage.setItem('access_token', value), token);
  const responses: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/')) responses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  await page.goto('/dashboard/classes');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/class-01-calendar.png', fullPage: true });
  const meetingLink = page.getByRole('link', { name: /Google Meet/ });
  await expect(meetingLink).toBeVisible();
  await expect(meetingLink).toHaveAttribute('href', 'https://meet.google.com/e2e-clock-20260930');
  await page.screenshot({ path: 'test-results/class-03-before-join.png', fullPage: true });
  await meetingLink.click({ noWaitAfter: true });
  await page.waitForTimeout(3000);
  await page.goto('/dashboard/notifications');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/class-02-notification.png', fullPage: true });
  await expect(page.getByText('یادآوری کلاس').first()).toBeVisible();
  await expect(page.getByText('https://meet.google.com/e2e-clock-20260930').first()).toBeVisible();
  console.log(responses.join('\n'));
  if (process.env.KEEP_BROWSER_OPEN === 'true') await page.pause();
});
