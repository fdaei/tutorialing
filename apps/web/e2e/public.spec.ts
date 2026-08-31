import { test, expect } from '@playwright/test';
test('public discovery and auth are accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('زبان فعال')).toBeVisible();
  await expect(page.getByText('مدرس تأییدشده', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('+۱۲۰٬۰۰۰')).toHaveCount(0);
  await expect(page.getByText('الهام نادری')).toHaveCount(0);
  await page.goto('/teachers');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('مدرسی');
  await expect(page.getByRole('button', { name: 'جست‌وجو', exact: true })).toBeVisible();
  await page.goto('/teachers/sara-dadkhah');
  const guestBooking = page.getByRole('link', { name: 'ورود و انتخاب زمان' });
  await expect(guestBooking).toBeVisible();
  await expect(guestBooking).toHaveAttribute('href', /\/auth\?next=%2Fcheckout%3Fteacher%3Dteacher-sara/);
  await page.goto('/languages');
  await expect(page.getByRole('heading', { name: 'عربی' })).toBeVisible();
  await expect(page.getByRole('link', { name: /دیدن مسیر این زبان/ })).toHaveCount(10);
  await page.goto('/languages/german');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('آلمانی');
  await expect(page.getByRole('heading', { name: /دوره‌های زبان آلمانی/ })).toBeVisible();
  await page.goto('/auth');
  await expect(page.getByLabel('شماره موبایل')).toBeVisible();
});
test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.getByText('زبان فعال')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await page.goto('/teachers');
  const menuButton = page.getByRole('button', { name: 'باز کردن منو' });
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-main-navigation a[aria-current="page"]')).toContainText('مدرس');
  await page.keyboard.press('Escape');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

  await page.goto('/placement');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
