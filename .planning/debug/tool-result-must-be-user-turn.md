---
status: resolved
trigger: "After approving a pending memory pill and sending a new chat message, Anthropic API returns: messages.7: tool_result blocks can only be in user messages"
created: 2026-05-31
updated: 2026-05-31
---

## Symptoms

expected: After approving a memory pill (which persists + appends a paired ToolResultBlock to the assistant ChatMessage) and sending a new message, the next API call succeeds.
actual: Anthropic returns 400 — `messages.7: tool_result blocks can only be in user messages`.
reproduction: Approve a seeded/real memory pill, then send any follow-up chat message.

## Resolution

root_cause: `ChatService.buildApiMessages` serialized each stored `ChatMessage` naively (`{ role: msg.role, content: toAnthropicContent(msg.blocks) }`). Plan 03-07 intentionally co-locates the `ToolResultBlock` inside the SAME assistant `ChatMessage` that holds the `tool_use` (so chat-block-serializer's same-message `pairedToolResultIds` guard can pair them). On the wire that produced an `assistant` turn containing a `tool_result` block, which Anthropic forbids — `tool_result` may only appear in `user` turns.

fix: Edited only `buildApiMessages`. For each windowed message, compute `toAnthropicContent(msg.blocks)`, then partition into `toolResults` (type === 'tool_result') and `others`. Push `others` under the message's own role, push `toolResults` under `role: 'user'`. After assembling, coalesce consecutive same-role messages (concatenate content arrays) so the split `assistant{tool_use}` → `user{tool_result}` → `user{new text}` collapses to `assistant{… tool_use}` then `user{tool_result, new text}` — alternating roles, tool_result first, every tool_use paired. Persistence shape unchanged; `toAnthropicContent` unchanged; co-location preserved (serializer guard still works). Imported `ContentBlockParam` from `@anthropic-ai/sdk/resources/messages` (sanctioned pattern, already used by chat-block-serializer.ts) for the coalesce cast — no `any`.

verification: New `describe('buildApiMessages tool_result placement …')` block in chat.service.spec.ts (4 specs, driven through public `sendMessage`): no assistant message contains a tool_result; the tool_result (tu1) appears in a user message; the matching tool_use (tu1) still appears in an assistant message; no two adjacent outbound messages share a role. chat.service.spec.ts suite green (37/37). SC5 grep gates stay green (no executor imports added).

files_changed: src/app/services/chat.service.ts, src/app/services/chat.service.spec.ts
