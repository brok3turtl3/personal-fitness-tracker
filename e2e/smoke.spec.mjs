// e2e/smoke.spec.mjs
// Per-route smoke: navigate each of the 8 feature routes and assert no
// console errors. Hash routing per CLAUDE.md "Hash-based routing stays".
const ROUTES = [
  '/cardio',
  '/weight',
  '/readings',
  '/diet',
  '/charts',
  '/report',
  '/chat',
  '/settings',
];

export async function runSmoke(browser, baseUrl) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });

  try {
    for (const route of ROUTES) {
      const url = baseUrl + '/#' + route;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise((r) => setTimeout(r, 250));

      if (errors.length > 0) {
        const detail = errors.map((e) => '  - ' + e).join('\n');
        throw new Error('Smoke route ' + route + ' produced errors:\n' + detail);
      }
      console.log('  smoke OK: ' + route);
    }
  } finally {
    await page.close();
  }
}
