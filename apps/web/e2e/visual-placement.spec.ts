import { expect, test } from '@playwright/test';

test('visual placement flow', async ({ page }) => {
  const apiResponses: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/')) apiResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  await page.goto('/placement');
  await page.screenshot({ path: 'test-results/visual-01-placement-entry.png', fullPage: true });
  await expect(page.getByRole('heading', { name: 'آزمون تعیین سطح زبان' })).toBeVisible();

  const language = page.locator('.placement-language-card').first();
  await language.click();
  await page.screenshot({ path: 'test-results/visual-02-language-selected.png', fullPage: true });
  const start = page.locator('.placement-start-button').first();
  await expect(start).toBeVisible();
  await start.click();
  await page.screenshot({ path: 'test-results/visual-03-test-started.png', fullPage: true });

  while (await page.locator('.placement-question-card').count()) {
    const option = page.locator('.placement-option').first();
    await option.click();
    const next = page.locator('.placement-primary-action');
    await next.click();
    await page.waitForTimeout(100);
    if (await page.locator('.placement-result').count()) break;
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/visual-04-placement-result.png', fullPage: true });
  console.log(apiResponses.join('\n'));
  await expect(page.locator('body')).not.toContainText('Internal Server Error');
});
