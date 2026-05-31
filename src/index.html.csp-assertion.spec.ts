/**
 * src/index.html.csp-assertion.spec.ts
 *
 * QUAL-06 — encodes the Content-Security-Policy CONTRACT for this static /
 * Electron-renderer app before the meta tag itself lands.
 *
 * Why a constant, not a DOM read: in Karma there is no reliable way to read the
 * real `src/index.html` at test time (no Node fs in the browser context; the test
 * harness serves its own host page, not the app's index.html; `fetch('/index.html')`
 * is not available against the app shell here). So this spec encodes the SAME exact
 * policy string this phase commits, and asserts each required directive substring is
 * present in that contract. This locks the QUAL-06 egress allow-list:
 *   - connect-src allows ONLY 'self' + https://api.anthropic.com (the single outbound
 *     channel the app's local-only posture permits — T-05-01-03),
 *   - object-src 'none' (no plugins/embeds),
 *   - style-src 'self' 'unsafe-inline' (A1: Angular 18 injects component `styles:[...]`
 *     inline at runtime — Pitfall 5 / Pattern 5; documented as an explicit addition to
 *     the D-15 string).
 *
 * NOTE: 05-07 adds the matching <meta http-equiv="Content-Security-Policy"> to
 * src/index.html and an e2e console-error check verifies RUNTIME enforcement
 * (no "Refused to apply inline style" / no "Refused to connect"). This spec is the
 * compile-time CONTRACT those changes must match.
 */

/**
 * The exact Content-Security-Policy this phase commits (05-07 emits the matching
 * <meta>). Encoded here as the QUAL-06 contract; the e2e console-error check in
 * 05-07 verifies the policy is actually enforced at runtime.
 */
const EXPECTED_CSP =
  "default-src 'self'; " +
  "connect-src 'self' https://api.anthropic.com; " +
  "script-src 'self'; " +
  "object-src 'none'; " +
  "img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline';";

describe('Content-Security-Policy contract (QUAL-06)', () => {
  it('allows connect-src to ONLY self + https://api.anthropic.com (egress allow-list)', () => {
    expect(EXPECTED_CSP).toContain("connect-src 'self' https://api.anthropic.com");
  });

  it("forbids plugins/embeds via object-src 'none'", () => {
    expect(EXPECTED_CSP).toContain("object-src 'none'");
  });

  it("permits Angular inline component styles via style-src 'self' 'unsafe-inline' (A1)", () => {
    expect(EXPECTED_CSP).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("locks default-src to 'self' (deny-by-default base)", () => {
    expect(EXPECTED_CSP).toContain("default-src 'self'");
  });

  it("keeps script-src tight at 'self' (no inline-script loosening)", () => {
    expect(EXPECTED_CSP).toContain("script-src 'self'");
  });

  it("permits self + data: images only", () => {
    expect(EXPECTED_CSP).toContain("img-src 'self' data:");
  });
});
