# Wiki

The account of the Pulse build — what it is for, the decisions behind it, where it stands
and what is next. The board holds the raw plan; these articles hold what it settled into.

## Purpose and direction

- [What Pulse is for](what-pulse-is-for.md) — a chat-first life manager for one private user, five areas, two products from one codebase
- [Where the build stands](where-the-build-stands.md) — feature-complete; the gate is a fourteen-day Play closed test, not code
- [Next steps and backlog](next-steps-and-backlog.md) — the Play test first, the cache-write fix alongside, cleanup when in the area

## Design decisions

- [Propose then Apply](propose-then-apply.md) — the AI proposes, one server function writes, the user confirms every change
- [Provider abstraction and cost](provider-abstraction-and-cost.md) — Claude or OpenAI per user, daily caps, a usage ledger, and the cache-write fix
- [Security and cost posture](security-and-cost-posture.md) — the pre-launch audit: what a user could do to their own cap, and how rules and size bounds now stop it
