---
phase: 03-ai-memory-tool-plumbing
plan: 06
subsystem: chat
tags: [chat, dev-seed, lifecycle, gap-closure, uat]
gap_closure: true
requires:
  - "chat-page.component.ts ngOnInit + consumeDevSeedIfPresent (Plan 03-05)"
  - "StorageService.consumeDevSeed (read-and-remove, D-12)"
  - "ChatService.getConversations / createConversation / appendAssistantBlocks / getConversation"
provides:
  - "ngOnInit auto-selects (or seed-gated auto-creates) a conversation BEFORE consuming the dev-seed sentinel — UAT Test 2 fix"
  - "appendSeededPill shared block builder used by both the init path and the legacy direct-call path"
  - "Regression spec that drives ngOnInit end-to-end with NO manual activeConversationId assignment"
affects:
  - src/app/features/chat/chat-page.component.ts
  - src/app/features/chat/chat-page.component.spec.ts
tech-stack:
  added: []
  patterns:
    - "Capture-then-branch on a read-and-remove sentinel (consume seed into a local before deciding to auto-create) so the seed is never destroyed without being acted upon"
    - "Auto-create gated on a non-null dev seed to preserve the Phase 1 empty-state characterization spec"
key-files:
  created: []
  modified:
    - src/app/features/chat/chat-page.component.ts
    - src/app/features/chat/chat-page.component.spec.ts
decisions:
  - "Chose diagnosis option #1 (defer consumption until a conversation exists) over option #2 (non-destructive peekDevSeed) — zero StorageService change, minimum surface area for a gap closure"
  - "Auto-create on init is GATED on seed !== null so the empty-state Phase 1 spec is preserved"
metrics:
  duration: "~2m 11s"
  completed: "2026-05-31"
  tasks: "1/1"
  files: 2
  commits: 3
---

# Phase 3 Plan 06: Dev-Seed Pending-Pill Lifecycle Fix (UAT Test 2) Summary

Reorders `chat-page` ngOnInit so a conversation is active before the dev-seed sentinel is consumed — closing UAT Test 2 where the seed was silently destroyed before any pending pill could render.

## What Changed

### `ngOnInit` — before

```typescript
ngOnInit(): void {
  this.storageService.initialize().pipe(...).subscribe(() => {
    this.aiSettingsService.hasValidApiKey().pipe(...).subscribe(valid => {
      this.hasApiKey = valid;
      if (valid) {
        this.loadConversations();          // fire-and-forget; activeConversationId still null
        this.consumeDevSeedIfPresent();    // consumeDevSeed() removes sentinel, then early-returns on null activeConversationId
      }
    });
  });
}
```

The sentinel was read-and-removed by `StorageService.consumeDevSeed()` while `activeConversationId === null`, so the guard `if (!this.activeConversationId) return;` fired *after* the sentinel was already destroyed. Net effect: seed gone, no pill.

### `ngOnInit` — after

`ngOnInit` now delegates to a new private `initializeActiveConversationAndConsumeSeed()`:

```typescript
private initializeActiveConversationAndConsumeSeed(): void {
  this.chatService.getConversations().pipe(...).subscribe(convs => {
    this.conversations = convs;
    const seed = this.storageService.consumeDevSeed();   // captured locally first

    if (convs.length > 0) {
      const first = convs[0];                            // getConversations sorts updatedAt DESC
      this.activeConversationId = first.id;
      this.activeConversation = first;
      if (seed) this.appendSeededPill(first.id, seed);
    } else if (seed) {
      this.chatService.createConversation().pipe(...).subscribe({
        next: conv => {
          this.conversations = [conv];
          this.activeConversationId = conv.id;
          this.activeConversation = conv;
          this.appendSeededPill(conv.id, seed);
        },
        error: err => console.error('[chat-page] auto-create conversation failed', err),
      });
    }
    // empty list + no seed → leave activeConversation null (empty-state preserved)
  });
}
```

The pending-pill block builder was extracted into a shared private `appendSeededPill(conversationId, seed)`. The public `consumeDevSeedIfPresent()` is preserved (still read-and-remove + active-conversation guard) and now delegates to `appendSeededPill` — keeping the existing Plan 03-05 direct-call specs (which manually assign `activeConversationId`) green.

## Why option #1 over option #2

The diagnosis offered two implementation routes for the seed-vs-auto-create ordering. **Option (b)/#1 — capture `consumeDevSeed()` into a local and branch on it — was chosen** because it requires **zero change to `StorageService`** (no new `peekDevSeed()` public method). Capture-then-branch guarantees the read-and-remove value is always acted on (or consciously dropped), honoring the gap-closure principle of minimum surface area.

## Auto-create gating (Phase 1 spec preservation)

Auto-create on init is **gated on `seed !== null`**. With an empty conversation list and no seed, `activeConversation` stays `null`, so the Phase 1 characterization spec `should render <app-empty-state> when no conversations exist` (chat-page.component.spec.ts:205-217) still passes. Spec 4 below explicitly locks this invariant.

## The 4 new regression specs

Added under `describe('ngOnInit dev-seed regression (UAT Test 2 — gap-closure plan 03-06)')`:

1. **THE regression net** — `consumes dev seed AND renders pending pill when ngOnInit runs and conversations already exist (no manual activeConversationId)`. Drives `ngOnInit` end-to-end via `fixture.detectChanges()` with NO manual `activeConversationId` assignment and NO direct `consumeDevSeedIfPresent` call. This is the spec that would have caught the bug during Plan 03-05.
2. **Auto-create branch** — empty list + profile seed → `createConversation` called once, pill appended to `c-new`.
3. **Sentinel-absent no-op** — 1 conversation, no seed → auto-select happens, `appendAssistantBlocks` NOT called, `consumeDevSeed` still peeked once.
4. **Empty-state invariant** — empty list + no seed → no auto-create, `activeConversation` stays null (Phase 1 empty-state surface preserved).

The conflicting "auto-create even with no seed" variant from the early plan draft was deliberately NOT added (per the plan's own resolution at lines 214-230) — it would clobber the empty-state surface.

## Spec count delta

- Full Karma suite: **491 SUCCESS** (was 487; **+4** as planned).
- chat-page.component.spec.ts: 14 → 18 specs.

## Verification

| Gate | Result |
|------|--------|
| Targeted chat-page spec | 18/18 SUCCESS |
| Full Karma suite | 491/491 SUCCESS |
| Production build | exit 0 (pre-existing 4.67 kB bundle-budget warning only) |
| `grep -c initializeActiveConversationAndConsumeSeed\|appendSeededPill` | 7 |
| `grep -c "ngOnInit dev-seed regression (UAT Test 2"` | 1 |
| SC5 grep `ToolRegistryService\|MemoryToolExecutor` | 0 matches (exit 1) |
| `grep -c consumeDevSeed` | 6 |

## Threat-model compliance

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-3-06-RG | mitigate | SC5 grep gate green — zero `ToolRegistryService`/`MemoryToolExecutor` references in chat-page.component.ts. No new imports; purely lifecycle/init-order. |
| T-3-06-AC | mitigate | Auto-create gated on non-null dev seed (writable only from /settings/ai on localhost); empty seed → empty-state, no implicit conversation. |
| T-3-06-SD | mitigate | `createConversation()` error handler logs via `console.error` and leaves `activeConversation` null → falls through to empty-state surface. |
| T-3-06-RACE | accept | Dev-only sentinel; concurrent-tab last-write-wins is the existing CLAUDE.md known limitation, not a regression. |

## Deviations from Plan

None — plan executed exactly as written (option (b) chosen, Spec 4 = empty-state-preservation variant, conflicting auto-create-without-seed variant dropped per plan resolution).

## TDD Gate Compliance

- RED gate: `test(03): add failing dev-seed ngOnInit regression specs (UAT Test 2)` — b89e3c5 (3 of 4 new specs failed as expected).
- GREEN gate: `fix(03): consume dev-seed sentinel AFTER conversation auto-select (UAT Test 2)` — ef9ca46 (18/18 chat-page, 491/491 full suite).
- REFACTOR: not needed — `appendSeededPill` extraction was part of the GREEN change.

## UAT status

**UAT Test 2 ready for operator re-run; Test 3 unblocked.** Once the operator clicks "Seed pending memory proposal" on /settings/ai and navigates to /chat, a pending pill renders ("AI wants to remember this:" + three action buttons), which then produces the approvable pill Test 3 (memory inspector after approval) depends on.

## Self-Check: PASSED

- FOUND files exist: chat-page.component.ts, chat-page.component.spec.ts (modified, verified by passing build/specs).
- Commits exist: b89e3c5 (test/RED), ef9ca46 (fix/GREEN).
