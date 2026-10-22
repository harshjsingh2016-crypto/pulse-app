---
boards: [pulse/blueprint]
updated: 2026-10-22
---

# Propose then Apply

The AI never mutates data. A chat turn returns one friendly sentence plus a list of
`proposed_actions`; the client renders each as a chip, and only a tap on Apply sends that
action to `executeAction`, the single server-side write path with around 27 action types.
Applied indexes are stored on the message so the chips survive a reload.

Three things make the proposals worth applying. First, grounding: every turn injects a
trimmed snapshot of the user's live data — tasks, domains, today's recurring state, a week
of meals, two weeks of workouts, a week of spends, goals and health — so the model proposes
against reality rather than guessing. Second, a per-user daily cap and a usage ledger run
before and after the model call, so cost is bounded and visible. Third, the parser accepts
both fenced and bare JSON, because the OpenAI models often drop the fence.

The decision to route every write through one function, rather than letting the client
write what the model proposed, is what makes the pattern safe. Domain names resolve to ids
server-side, subtasks are referenced by title so ids never reach the model, and completing
a task is a move to `completed_tasks` rather than a flag. The same function backs the direct
tabbed forms, so both paths obey the same rules.

## Related

- [What Pulse is for](what-pulse-is-for.md) — the friction thesis this pattern serves
- [Provider abstraction and cost](provider-abstraction-and-cost.md) — how the model behind the proposals is chosen and paid for
