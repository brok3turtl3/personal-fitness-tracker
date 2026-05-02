// e2e/run.mjs
// Puppeteer entrypoint for Phase 1 e2e harness.
// Two-terminal flow (RESEARCH §line 811):
//   Terminal 1: ng serve --port 4200
//   Terminal 2: npm run e2e
import puppeteer from 'puppeteer';
import { runSmoke } from './smoke.spec.mjs';
import { runA11y } from './a11y.spec.mjs';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4200';

let exitCode = 0;
const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
});

try {
  await runSmoke(browser, BASE_URL);
  await runA11y(browser, BASE_URL);
  console.log('e2e PASS');
} catch (err) {
  console.error('e2e FAIL:', err && err.stack ? err.stack : err);
  exitCode = 1;
} finally {
  await browser.close();
}

process.exit(exitCode);
