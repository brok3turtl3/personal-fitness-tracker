---
phase: 3
slug: ai-memory-tool-plumbing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jasmine + Karma (Angular default) |
| **Config file** | `karma.conf.js` (Angular CLI default) |
| **Quick run command** | `ng test --no-watch --include="src/app/**/<changed>.spec.ts"` |
| **Full suite command** | `ng test --no-watch` |
| **Estimated runtime** | ~30–60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (scoped to changed `*.spec.ts`)
- **After every plan wave:** Run full suite (`ng test --no-watch`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Filled by planner during PLAN.md generation. Each task's `<automated>` block emits a `ng test --no-watch --include="<spec>"` command, which the executor records here as it ticks tasks complete.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | TBD  | TBD         | TBD        | TBD             | TBD       | TBD               | TBD         | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Pulled from RESEARCH.md "Validation Architecture" section. Wave 0 specs MUST exist before Wave 1 task execution begins. Planner SHOULD assign these to a Wave 0 plan (or fold them into the first task of each domain plan).

- [ ] `src/app/services/storage.service.spec.ts` — extend with `migrateV4ToV5` cases (V4 fixture, V5-expected fixture, malformed-V4 matrix, idempotent-replay)
- [ ] `src/app/services/storage.service.spec.ts` — recovery-key restore path (CHAT-01 success criterion #1)
- [ ] `src/app/services/user-profile.service.spec.ts` — round-trip CRUD via StorageService, default-shape on V5 init
- [ ] `src/app/services/memory-store.service.spec.ts` — typed CRUD, capacity guard, default empty `memoryFiles`
- [ ] `src/app/services/memory-tool-executor.service.spec.ts` — all 6 memory-tool commands (`view`, `create`, `str_replace`, `insert`, `delete`, `rename`) success + error strings (verbatim from canonical Anthropic memory-tool spec)
- [ ] `src/app/services/memory-tool-executor.service.spec.ts` — path validator: traversal (`..`, `%2e%2e`), NUL byte, absolute path, zero-width unicode padding, segment-level checks
- [ ] `src/app/services/tool-registry.service.spec.ts` — registration + dispatch + per-tool argument re-validation through domain validators (CHAT-11)
- [ ] `src/app/services/anthropic-api.service.ts` (impl) + `*.spec.ts` — typed `ChatBlock[]` request/response, drop discarded blocks, drop placeholder pending blocks, strip `status`/`editedFromText` on approved/edited blocks (wire-leak prevention)
- [ ] `src/app/services/chat-block-serializer.spec.ts` — `toAnthropicContent` round-trip + drop/strip rules (the wire bridge spec)
- [ ] `src/app/services/fitness-context.service.spec.ts` — prompt-injection delimiter wrap: `</system>` payload escaped, `</user_profile_*>` closing-tag injection escaped, "ignore previous instructions" payload contained, zero-width-char corpus contained
- [ ] `src/app/services/fitness-context.service.spec.ts` — single-shot behavior preserved (SC5 regression — same wire payload shape as V4 chat for plain-text user message)
- [ ] `src/app/features/settings/settings-page.component.spec.ts` — route shell renders, sub-route nav present
- [ ] `src/app/features/settings/profile-editor.component.spec.ts` — reactive form round-trips through UserProfileService
- [ ] `src/app/features/settings/ai-tool-settings.component.spec.ts` — toggle + cap controls bind to `aiToolSettings` (data-query, memory, web-search, agent-turn cap, web-search cap)
- [ ] `src/app/features/settings/memory-inspector.component.spec.ts` — list + delete controls operate on `memoryFiles`
- [ ] `src/app/features/chat/chat-page.component.spec.ts` — preserve existing characterization assertions (Phase 1 baseline) post-block migration; add block-aware text rendering assertion
- [ ] `src/app/features/chat/chat-message-list.component.spec.ts` — block-aware rendering: `text` block renders inline, `tool_use`/`tool_result` blocks render pending-pill scaffold (no behavior — UI shell only per CHAT-04 plumbing scope)
- [ ] Fixture files: `src/app/services/__fixtures__/v4-app-data.json`, `v5-expected.json`, `v4-malformed-matrix.json`, prompt-injection corpus

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single-shot chat behavior unchanged for the end-user (no agentic loop) | SC5 / CHAT-04 plumbing-only | Live wire interaction with real Claude API endpoint after schema migration; characterization spec catches the wire shape but human confirms UX feel | `ng serve`, send a normal chat message on `/chat`, confirm response renders in same single-shot manner as V4 main branch |
| V4 user upgrade preserves conversations + backup-key recovery banner | SC1 / CHAT-01 | LocalStorage state migration is best confirmed by reproducing a real V4 LocalStorage payload in a browser session | Load `v4-app-data.json` fixture into LocalStorage via DevTools → reload app → confirm conversations render + recovery key surfaced + V5 defaults populated |
| Settings page navigation feels right (sub-route shell + breadcrumbs) | UI-SPEC §1 | Subjective UX | Visit `/settings` and click each sub-route; confirm reactive forms save + reflect in next chat message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
