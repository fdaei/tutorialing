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

test('English homepage keeps its language, direction, and navigation context', async ({ page }) => {
  await page.goto('/en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A complete route to fluency');
  await expect(page.getByText('Active languages', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse courses' }).first()).toHaveAttribute('href', '/en/courses');
  await expect(page.getByText('زبان فعال')).toHaveCount(0);
});

test('English CMS pages preserve localized navigation and metadata', async ({ page }) => {
  await page.goto('/en/about');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('About us');
  await expect(page.getByText('The LingoSpeak story')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick links' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/en/privacy');
  await expect(page).toHaveTitle(/About us/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/about$/);
});

test('English course discovery and detail remain localized', async ({ page }) => {
  await page.goto('/en/courses');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Language courses');
  await expect(page.getByRole('button', { name: 'German' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View course' }).first()).toHaveAttribute('href', /\/en\/courses\//);

  await page.goto('/en/courses/english-conversation');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fluent English conversation');
  await expect(page.getByRole('heading', { name: 'What will you learn?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave a rating and review' })).toBeVisible();
  await expect(page.getByText('ضمانت بازگشت وجه تا ۷ روز')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/courses\/english-conversation$/);
});

test('English teacher discovery and profile preserve booking context', async ({ page }) => {
  await page.goto('/en/teachers');
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
  await expect(page.getByLabel('Language')).toContainText('German');
  await expect(page.getByLabel('Minimum rating')).toContainText('4 stars and up');

  await page.goto('/en/teachers/sara-dadkhah');
  await expect(page.getByText('Verified LingoSpeak teacher')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About the teacher' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Learner reviews of this teacher' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to choose a time' })).toHaveAttribute(
    'href',
    /\/en\/auth\?next=%2Fen%2Fcheckout%3Fteacher%3Dteacher-sara/,
  );
});
