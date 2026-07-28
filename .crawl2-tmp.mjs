import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
for (const bypass of [false, true]) {
  const ctx = await browser.newContext({ bypassCSP: bypass });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  const len = await page.evaluate(() => document.body.innerText.trim().length);
  const txt = await page.evaluate(() => document.body.innerText.trim().slice(0, 120));
  console.log(`bypassCSP=${bypass} bodyLen=${len} errors=${errs.length} text="${txt.replace(/\n/g, ' | ')}"`);
  await ctx.close();
}
await browser.close();
