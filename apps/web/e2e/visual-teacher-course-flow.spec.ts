import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

test('visual teacher creates a live course draft', async ({ page }) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
  const token = jwt.sign({ id: 'user-teacher-shahriar', roles: ['INSTRUCTOR'], permissions: [] }, secret, { expiresIn: '15m' });
  await page.addInitScript((value) => sessionStorage.setItem('access_token', value), token);
  const slug = `e2e-live-course-${Date.now()}`;
  const responses: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/')) responses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  await page.goto('/teacher-panel/courses');
  await page.getByText('ساخت دوره زنده جدید').click();
  await page.getByLabel('عنوان فارسی').fill('دوره مکالمه سریع تستی');
  await page.getByLabel('عنوان انگلیسی').fill('E2E Live Conversation Course');
  await page.getByLabel(/نامک/).fill(slug);
  await page.getByLabel('زبان دوره').selectOption('en');
  await page.getByLabel('سطح').fill('A2');
  await page.getByLabel('مدت هر جلسه (دقیقه)').fill('30');
  await page.getByLabel('توضیح فارسی').fill('این دوره برای تست کامل مسیر کلاس زنده ساخته شده است.');
  await page.getByLabel('توضیح انگلیسی').fill('This course is created to test the complete live class flow.');
  await page.screenshot({ path: 'test-results/teacher-01-course-form.png', fullPage: true });
  await page.getByRole('button', { name: 'ساخت دوره پیش‌نویس' }).click();
  await expect(page.getByText(/دوره به‌صورت پیش‌نویس ساخته شد/)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'test-results/teacher-02-course-draft.png', fullPage: true });
  console.log(`created slug=${slug}\n${responses.join('\n')}`);
});
