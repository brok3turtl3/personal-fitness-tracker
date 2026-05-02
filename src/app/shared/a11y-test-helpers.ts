/**
 * Test-side axe-core wrapper.
 *
 * After mounting a standalone component in TestBed, call
 * `await expectNoSeriousA11yViolations(fixture.nativeElement)` to assert
 * the DOM has no `serious` or `critical` axe-core violations.
 *
 * Per D-08: failures are gated to `serious | critical` only. Minor and
 * moderate violations don't fail Phase 1 specs; QUAL-08 in Phase 5 does
 * the manual full sweep.
 *
 * Source: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md
 *
 * Dev-only by construction: `axe-core` lives in devDependencies. Production
 * code must NEVER import this helper — any such import would fail
 * `ng build --configuration=production`. See the threat register for plan
 * 01-02 (T-02-03).
 *
 * ## Phase 5 deferrals (`disableRules`)
 *
 * Plan 01-08's characterization specs uncovered that the current global
 * palette (`#7f8c8d` muted text, `#3498db` primary buttons) sits at WCAG
 * AA contrast ratios of ~3.15-3.47:1 — below the 4.5:1 threshold that
 * axe-core flags as `serious`. Per CONTEXT.md D-13, the cross-app palette
 * polish is **QUAL-08/QUAL-09 in Phase 5**, not Phase 1's concern. Phase 1
 * landing the harness with this rule disabled keeps the refactor-safety-net
 * goal of FOUND-04 (catch structural regressions: label association, ARIA
 * roles, focus order, landmarks) intact while deferring the design-system
 * palette work to its rightful phase.
 *
 * Callers may pass `{ disableRules: ['color-contrast'] }` to opt out of
 * specific rules. All other rules at `serious|critical` continue to fail
 * the spec. When Phase 5 fixes the palette globally, the disabled list
 * across characterization specs should be removed.
 */
import axe, { AxeResults, Result, RuleObject } from 'axe-core';

const SEVERE_IMPACTS: ReadonlyArray<Result['impact']> = ['serious', 'critical'];

export interface A11yAssertionOptions {
  /**
   * axe-core rule IDs to skip. Use sparingly and only with a documented Phase 5
   * follow-up (e.g., `color-contrast` is deferred to QUAL-08 — see file header).
   */
  disableRules?: ReadonlyArray<string>;
}

export async function expectNoSeriousA11yViolations(
  root: Element,
  options: A11yAssertionOptions = {},
): Promise<void> {
  const rules: RuleObject = {};
  for (const id of options.disableRules ?? []) {
    rules[id] = { enabled: false };
  }

  const results: AxeResults = await axe.run(root, { rules });
  const severe = results.violations.filter(v => SEVERE_IMPACTS.includes(v.impact));

  // Always emit an expectation so Jasmine doesn't warn about "no expectations".
  expect(severe.length).toBe(0);

  if (severe.length === 0) return;

  const summary = severe
    .map(v => `[${v.impact}] ${v.id}: ${v.help} — ${v.nodes.length} node(s)`)
    .join('\n');
  fail(`Found ${severe.length} serious/critical a11y violation(s):\n${summary}`);
}
