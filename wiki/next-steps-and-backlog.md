---
boards: [pulse/blueprint]
updated: 2026-10-22
---

# Next steps and backlog

The next step is the Google Play closed test: get twelve testers opted in, keep them in for
fourteen continuous days, then request production access. Everything else waits behind it
or runs alongside it without blocking.

Alongside it, in order of value: confirm the deployed Claude cache-write fix in the usage
ledger after a few Claude turns; reconsider the new-account
transcription default, which is the costlier of the two OpenAI transcription models; and
bring `PROJECT_CONTEXT.md` back in line with the code, since it still describes the old
fixed cap of 100 messages per day.

Cleanup that can go whenever a session is in the area: the `seedRecurringToday` scheduled
function queries a collection that does not exist and only logs, and the magic-link files
(`callback.tsx`, `emailStore.ts`) are unused. The pricing table in the usage ledger is
hand-maintained and should be checked against real invoices. The keyboard-aware drawer fix
was applied to two of seven drawers; the rest get it only if the symptom appears.

Later: iOS on the App Store, once Android is stable.

## Related

- [Where the build stands](where-the-build-stands.md) — why the Play gate is the critical path
- [Provider abstraction and cost](provider-abstraction-and-cost.md) — the cache-write bug in detail
