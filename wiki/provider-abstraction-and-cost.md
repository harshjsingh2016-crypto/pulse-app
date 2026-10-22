---
boards: [pulse/blueprint]
updated: 2026-10-22
---

# Provider abstraction and cost

Chat started Anthropic-only. It became a provider abstraction, `callLLM`, that dispatches to
Claude or OpenAI and returns the same shape either way. Which provider a user gets is one
field on their user document, `chat_provider`, switchable from the Options sheet without a
redeploy. Each provider has a large slot for chat surfaces and a small slot for cheap work
such as macro inference. New accounts default to OpenAI; accounts without the field fall
back to Claude at read time.

Cost is controlled four ways. Prompt caching on both providers. A per-user daily cap,
default 10, counted separately for chat and voice and resettable at local midnight; an
admin raises it per user by editing `daily_message_limit` on the user document. A usage
ledger that records tokens and a computed cost per day per model. And the small model for
anything that does not need the large one.

One cost bug ran for months and was fixed in code on 22 October 2026. Claude was given two
cache breakpoints, and the second was the per-turn context snapshot, which changes nearly
every turn. Each turn therefore paid for a cache write at a premium rate, and the snapshot
was rarely read back. Now only the static system prompt carries the breakpoint; the
snapshot goes as a plain uncached block. The fix is not yet deployed to production, and
the proof will be the cache-creation column in the usage ledger falling after it is.

Dates everywhere are the user's local calendar day, passed from the client, never UTC —
evening entries in India were landing on the next day before that was fixed. The usage
ledger is the one exception and keys on UTC days.

## Related

- [Propose then Apply](propose-then-apply.md) — the turn this abstraction sits inside
- [Next steps and backlog](next-steps-and-backlog.md) — where the cache-write fix is queued
