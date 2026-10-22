---
boards: [pulse/blueprint]
updated: 2026-10-22
---

# What Pulse is for

Pulse is a chat-first personal life manager. One user manages five life areas — tasks,
recurring habits, meals with automatic macro estimation, workouts, and spending — either by
talking to an AI in natural language or by using the tabbed forms directly. The AI path and
the direct path write to the same data, so neither is a second-class citizen.

The thesis is friction: logging and organising a life is tedious enough that most people
stop. An LLM that reads intent and pre-fills structured data removes most of the typing,
while the user keeps control because nothing is written without an explicit Apply (see
[Propose then Apply](propose-then-apply.md)).

It runs as one codebase producing two products: an Android app, live on Google Play closed
testing, and a website. The same Expo source serves both through react-native-web. The
design is a calm "warm notebook" — ink, paper, a leather accent — with no social feed and a
single private user per account.

Deliberately out of scope: multi-user or shared accounts, a social layer, and the AI writing
anything on its own. The sixth tab is not a feature; the five areas are the product.

## Related

- [Propose then Apply](propose-then-apply.md) — the pattern that keeps the AI convenient but safe
- [Where the build stands](where-the-build-stands.md) — what is live and what the current gate is
