---
boards: [pulse/blueprint]
updated: 2026-10-22
---

# Security and cost posture

Pulse has one real adversary: a signed-up user who wants to run up the bill, either by
using the chat as a free general-purpose model or by inflating what each turn costs. Data
isolation matters too, but it was already sound — every document lives under
`users/{uid}` and the rules allow only that user. The pre-launch audit on 22 October 2026
found the gaps elsewhere, and all of them were in what a user could do to their own cap.

The daily cap was enforced on the server but keyed and stored in ways the client
controlled. The counter document and the per-user limit field sat under the user's own
path, which the rules let them write, so a user could reset the counter or raise their
own limit. The counter was keyed on a client-supplied date, so a fresh date meant a fresh
counter. And two of the five paid endpoints, the task-review and domain-strategy chats and
the macro estimator, had no cap at all.

The fix has two halves. The rules now name each protected collection explicitly: `limits`
and `usage` are readable but never client-writable, chat messages can only have their
`applied_actions` marked, the user document rejects `daily_message_limit`, and the
catch-all wildcard excludes all of these so it cannot grant what they deny. A 23-case
emulator test in `scripts/test-rules.sh` pins that behaviour. On the server, every paid
call now passes through the limiter, the client date is honoured only within a day of
server time, and the size of a turn is bounded: messages to 2,000 characters, re-sent
history to 4,000 per message, the context snapshot's text fields clipped and its lists
capped, voice clips to 3 MB checked before decoding.

Prompt injection is a lesser risk here because the only data in the prompt is the user's
own, and nothing is written without Apply. The exposure was cost and misuse: a task note
could tell the model to ignore its rules and act as a general assistant. All three chat
prompts now carry a scope rule and state that the data block and history are data, not
instructions, and the task and domain chats send only the fields they need rather than
raw documents.

Keys were already server-only, with git history and the web bundle clean. The one change
was the reviewer sign-in bypass, which had hardcoded fallback values in a public
repository; it now exists only when both environment variables are set.

Two things are deliberately left open and sit on the board as suggestions: Firebase App
Check, which would stop a script from driving the callables at all rather than just
within the caps, and restricting the public Firebase API key to the app's domains and
package.

## Related

- [Provider abstraction and cost](provider-abstraction-and-cost.md) — the caps and ledger this posture protects
- [Where the build stands](where-the-build-stands.md) — the Play launch this audit cleared the way for
- [Next steps and backlog](next-steps-and-backlog.md) — the open items from the audit
