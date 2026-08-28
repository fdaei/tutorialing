import { expect, test, type Page } from '@playwright/test';

/**
 * Covers the password-style auth screens end to end against the running API.
 *
 * The recovery leg (forgot -> verify -> reset) rides on the real /auth/otp/*
 * endpoints, so these tests need the API up with AUTH_DEV_OTP=true, which is
 * what fixes the code at 123456 and returns it as `developmentCode`.
 */

const DEV_OTP = '123456';

/** A fresh number per test keeps the per-phone resend cooldown from bleeding across runs. */
function uniquePhone() {
  return `0912${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}0`.slice(0, 11);
}

async function sendRecoveryCode(page: Page, phone = uniquePhone()) {
  await page.goto('/forgot-password');
  await page.getByLabel('ایمیل یا شماره موبایل').fill(phone);
  await page.getByRole('button', { name: 'ارسال کد تأیید' }).click();
  await expect(page).toHaveURL(/\/verify-code$/);
  return phone;
}

test.describe('auth pages', () => {
  test('login renders RTL with the reference content', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ورود', exact: true })).toBeVisible();
    await expect(page.getByText('برای ادامه وارد حساب کاربری خود شوید')).toBeVisible();
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('img', { name: /سپر و قفل/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ورود با گوگل' })).toBeVisible();
  });

  test('login blocks an empty submit with Persian field errors', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'ورود', exact: true }).click();
    await expect(page.getByText('لطفاً ایمیل یا شماره موبایل خود را وارد کنید')).toBeVisible();
    await expect(page.getByText('لطفاً رمز عبور را وارد کنید')).toBeVisible();
  });

  test('password visibility toggle flips the input type', async ({ page }) => {
    await page.goto('/login');
    const password = page.getByLabel('رمز عبور', { exact: true });
    await password.fill('secret123');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'نمایش رمز عبور' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'پنهان کردن رمز عبور' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('register validates matching passwords and accepted terms', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('نام و نام خانوادگی').fill('نسیم دایی');
    await page.getByLabel('ایمیل یا شماره موبایل').fill('user@example.com');
    await page.getByLabel('رمز عبور', { exact: true }).fill('password123');
    await page.getByLabel('تکرار رمز عبور', { exact: true }).fill('password999');
    await page.getByRole('button', { name: 'ایجاد حساب' }).click();
    await expect(page.getByText('رمزهای عبور با یکدیگر مطابقت ندارند')).toBeVisible();
    await expect(page.getByText('برای ایجاد حساب باید قوانین و مقررات را بپذیرید')).toBeVisible();
  });

  test('navigates between login, register and forgot password', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'ثبت نام', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.getByRole('link', { name: 'ورود', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('link', { name: 'رمز عبور را فراموش کرده‌اید؟' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByRole('link', { name: 'بازگشت به ورود' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('recovery flow', () => {
  // Every test here spends from the API's per-IP OTP budget (30 sends per 10
  // minutes, shared by otp/request and otp/resend). Running the leg once rather
  // than once per device project keeps the suite inside that budget.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'covered once, per-IP OTP budget');
  });

  test('sends a real code and shows the countdown', async ({ page }) => {
    await sendRecoveryCode(page);
    await expect(page.getByRole('heading', { name: 'تأیید کد' })).toBeVisible();
    await expect(page.getByText(/ارسال مجدد کد تا/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'کد تأیید' }).getByRole('textbox')).toHaveCount(6);
  });

  test('rejects a wrong code with the API message', async ({ page }) => {
    await sendRecoveryCode(page);
    const boxes = page.getByRole('group', { name: 'کد تأیید' }).getByRole('textbox');
    for (let i = 0; i < 6; i += 1) await boxes.nth(i).fill('0');
    // Scoped to main: Next.js keeps its own role="alert" route announcer on the page.
    await expect(page.locator('main').getByRole('alert')).toContainText('کد تأیید صحیح نیست');
    await expect(page).toHaveURL(/\/verify-code$/);
  });

  test('pasting the code fills every box and completes the flow', async ({ page }) => {
    await sendRecoveryCode(page);
    const boxes = page.getByRole('group', { name: 'کد تأیید' }).getByRole('textbox');
    await boxes.first().focus();
    // Paste is what the OTP component special-cases, so drive the real event.
    await boxes.first().evaluate((node, code) => {
      const data = new DataTransfer();
      data.setData('text', code);
      node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    }, DEV_OTP);
    await expect(boxes.nth(5)).toHaveValue('6');
    // A complete code auto-submits, landing on the reset screen.
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByRole('heading', { name: 'تنظیم رمز عبور جدید' })).toBeVisible();
  });

  test('reset password enforces length and confirmation', async ({ page }) => {
    await sendRecoveryCode(page);
    const boxes = page.getByRole('group', { name: 'کد تأیید' }).getByRole('textbox');
    for (let i = 0; i < 6; i += 1) await boxes.nth(i).fill(DEV_OTP[i]!);
    await expect(page).toHaveURL(/\/reset-password$/);

    await page.getByLabel('رمز عبور جدید', { exact: true }).fill('short');
    await page.getByLabel('تکرار رمز عبور جدید').fill('short');
    await page.getByRole('button', { name: 'ذخیره رمز عبور' }).click();
    await expect(page.getByText('رمز عبور باید حداقل ۸ کاراکتر باشد')).toBeVisible();

    await page.getByLabel('رمز عبور جدید', { exact: true }).fill('password123');
    await page.getByLabel('تکرار رمز عبور جدید').fill('password456');
    await page.getByRole('button', { name: 'ذخیره رمز عبور' }).click();
    await expect(page.getByText('رمزهای عبور با یکدیگر مطابقت ندارند')).toBeVisible();
  });

  test('verify and reset are unreachable without a challenge', async ({ page }) => {
    await page.goto('/verify-code');
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.goto('/reset-password');
    await expect(page).toHaveURL(/\/forgot-password$/);
  });
});
