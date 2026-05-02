// e2e/a11y.spec.mjs
// axe-core injected per route via page.addScriptTag (RESEARCH §line 1240).
// Severity gate: serious | critical only (D-08).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

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

export async function runA11y(browser, baseUrl) {
  const axePath = require.resolve('axe-core/axe.min.js');
  const page = await browser.newPage();

  try {
    for (const route of ROUTES) {
      const url = baseUrl + '/#' + route;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => {
        const results = await window.axe.run(document);
        return results.violations.filter((v) =>
          v.impact === 'serious' || v.impact === 'critical'
        );
      });

      if (violations.length > 0) {
        const detail = violations
          .map((v) => '  - [' + v.impact + '] ' + v.id + ': ' + v.help + ' (' + v.nodes.length + ' node(s))')
          .join('\n');
        throw new Error('a11y route ' + route + ' has serious/critical violations:\n' + detail);
      }
      console.log('  a11y OK: ' + route);
    }
  } finally {
    await page.close();
  }
}
