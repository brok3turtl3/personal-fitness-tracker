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
 */
import axe, { AxeResults, Result } from 'axe-core';

const SEVERE_IMPACTS: ReadonlyArray<Result['impact']> = ['serious', 'critical'];

export async function expectNoSeriousA11yViolations(root: Element): Promise<void> {
  const results: AxeResults = await axe.run(root);
  const severe = results.violations.filter(v => SEVERE_IMPACTS.includes(v.impact));

  if (severe.length === 0) return;

  const summary = severe
    .map(v => `[${v.impact}] ${v.id}: ${v.help} — ${v.nodes.length} node(s)`)
    .join('\n');
  fail(`Found ${severe.length} serious/critical a11y violation(s):\n${summary}`);
}
