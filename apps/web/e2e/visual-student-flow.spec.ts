import { expect, test } from '@playwright/test';

test('visual student registration, login and placement', async ({ page }) => {
  const phone = `939${String(Date.now()).slice(-7)}`;
  const apiResponses: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/')) apiResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));

  await page.goto('/auth');
  await page.screenshot({ path: 'test-results/student-01-register.png', fullPage: true });
  await page.locator('#auth-phone').fill(phone);
  await page.getByRole('button', { name: /ارسال کد/ }).click();
  await page.screenshot({ path: 'test-results/student-02-otp.png', fullPage: true });
  const digits = page.locator('input[aria-label^="رقم"]');
  await expect(digits).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) await digits.nth(index).fill('123456'[index]!);
  await page.getByRole('button', { name: /تأیید و ورود/ }).click();
  await expect(page).toHaveURL(/dashboard|panel/);
  await page.screenshot({ path: 'test-results/student-03-dashboard.png', fullPage: true });

  await page.goto('/placement');
  await page.locator('.placement-language-card').first().click();
  await page.screenshot({ path: 'test-results/student-04-language.png', fullPage: true });
  await page.locator('.placement-start-button').first().click();
  await page.screenshot({ path: 'test-results/student-05-placement-start.png', fullPage: true });
  while (await page.locator('.placement-question-card').count()) {
    await page.locator('.placement-option').first().click();
    await page.locator('.placement-primary-action').click();
    await page.waitForTimeout(100);
    if (await page.locator('.placement-result').count()) break;
  }
  await page.screenshot({ path: 'test-results/student-06-placement-result.png', fullPage: true });
  await page.goto('/checkout?teacher=teacher-shahriar');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/student-07-checkout.png', fullPage: true });
  await expect(page.locator('body')).not.toContainText('Internal Server Error');
  console.log(apiResponses.join('\n'));
  await expect(page.locator('body')).not.toContainText('Internal Server Error');
});
