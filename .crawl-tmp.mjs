import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const ROUTES = [
  '/', '/teachers', '/teachers/arman-nikroush', '/placement', '/matching',
  '/teacher-apply', '/about', '/auth', '/dashboard', '/teacher-panel',
  '/admin', '/checkout', '/payment', '/panel', '/faq', '/contact',
  '/terms', '/privacy', '/en', '/en/teachers',
];

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const report = [];

for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 300)));
  page.on('requestfailed', (r) =>
    failedRequests.push(`${r.method()} ${r.url().slice(0, 140)} :: ${r.failure()?.errorText}`),
  );
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`HTTP ${r.status()} ${r.url().slice(0, 140)}`);
  });

  let status = null;
  let err = null;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
    status = resp?.status();
    await page.waitForTimeout(1500);
  } catch (e) {
    err = String(e.message).slice(0, 200);
  }

  let h1 = null, bodyLen = 0, overflow = null;
  try {
    h1 = await page.locator('h1').first().textContent({ timeout: 2000 }).catch(() => null);
    bodyLen = await page.evaluate(() => document.body.innerText.trim().length);
    overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
  } catch {}

  report.push({ route, status, err, h1: h1?.trim().slice(0, 60), bodyLen, overflow,
    consoleErrors: [...new Set(consoleErrors)], pageErrors: [...new Set(pageErrors)],
    failedRequests: [...new Set(failedRequests)] });
  await ctx.close();
}

await browser.close();

for (const r of report) {
  const problems = r.pageErrors.length + r.consoleErrors.length + r.failedRequests.length;
  const flag = r.err || problems > 0 || r.overflow ? '❌' : '✅';
  console.log(`\n${flag} ${r.route} [${r.status}] h1="${r.h1}" bodyLen=${r.bodyLen} overflow=${r.overflow}`);
  if (r.err) console.log(`   NAV ERROR: ${r.err}`);
  r.pageErrors.forEach((e) => console.log(`   PAGE ERROR: ${e}`));
  r.consoleErrors.forEach((e) => console.log(`   CONSOLE: ${e}`));
  r.failedRequests.forEach((e) => console.log(`   NET: ${e}`));
}
