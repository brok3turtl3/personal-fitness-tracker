// e2e/csp.spec.mjs
// QUAL-06 / A1 — Content-Security-Policy runtime check.
//
// Two assertions on a basic route load:
//   1. The CSP <meta http-equiv="Content-Security-Policy"> is present in the DOM
//      and carries the locked connect-src / object-src / style-src directives
//      (the egress allow-list — Anthropic API as the sole external connection).
//   2. ZERO CSP-violation console errors ("Refused to ...") fire — i.e. the
//      policy is actually enforced AND Angular's inline component styles still
//      load (A1: style-src 'self' 'unsafe-inline'). A "Refused to apply inline
//      style" or "Refused to connect" here means the policy broke the app.
//
// Wired into e2e/run.mjs alongside smoke + a11y; runs in the two-terminal flow
// (operator-verified — not executed in CI by the executor).

export async function runCsp(browser, baseUrl) {
  const page = await browser.newPage();
  const cspErrors = [];
  page.on('pageerror', (err) => {
    if (/Content Security Policy|Refused to/i.test(err.message)) {
      cspErrors.push('pageerror: ' + err.message);
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text())) {
      cspErrors.push('console.error: ' + msg.text());
    }
  });

  try {
    // Load a representative route (chat exercises the most component styles).
    await page.goto(baseUrl + '/#/chat', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 300));

    // 1. CSP meta tag present with the locked directives.
    const csp = await page.evaluate(() => {
      const el = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return el ? el.getAttribute('content') : null;
    });
    if (!csp) {
      throw new Error('CSP meta tag missing from the DOM');
    }
    const required = [
      "connect-src 'self' https://api.anthropic.com",
      "object-src 'none'",
      "style-src 'self' 'unsafe-inline'",
    ];
    for (const directive of required) {
      if (!csp.includes(directive)) {
        throw new Error('CSP missing required directive: ' + directive + '\n  got: ' + csp);
      }
    }

    // 2. No CSP-violation console errors (styles loaded; no blocked connects).
    if (cspErrors.length > 0) {
      const detail = cspErrors.map((e) => '  - ' + e).join('\n');
      throw new Error('CSP produced console violations:\n' + detail);
    }

    console.log('  csp OK: meta present + 0 violations on /#/chat');
  } finally {
    await page.close();
  }
}
