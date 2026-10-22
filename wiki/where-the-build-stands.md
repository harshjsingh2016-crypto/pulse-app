---
boards: [pulse/blueprint]
updated: 2026-10-22
---

# Where the build stands

The app is feature-complete. All five domains have a live Firestore data layer; the chat,
the per-domain strategy chat and the per-task review chat all work with the propose-Apply
pattern; voice input, habit reminders, haptics, offline persistence and crash reporting are
in. Auth is passwordless email OTP with account deletion and a public privacy page. The web
build is live on Firebase Hosting and the Cloud Functions are deployed on the Blaze plan.

The last code change before the launch push was from 1 August 2026: per-user daily limits
for chat and voice, replacing a fixed cap of 100. On 22 October 2026 a pre-launch audit
closed the gaps in those limits and in the Firestore rules (see
[Security and cost posture](security-and-cost-posture.md)), and the web app was redeployed
after three months on an old bundle.

The current gate is not code. A personal Google Play developer account must run a closed
test with at least twelve opted-in testers for fourteen continuous days before production
access is granted. The Android build, store listing, data-safety answers and a reviewer
sign-in bypass are all ready. Whether that fourteen-day clock has started, and how many
testers are in, is not recorded anywhere in the repo — that is the open flag on the board.

Several decisions were forced by production rather than planned: magic-link sign-in gave
way to OTP because deep links were unreliable; the `beforeUserCreated` function gave way to
a client-side bootstrap because blocking functions need Identity Platform; Firebase config
moved to EAS environment variables after a build shipped with none and crashed on launch;
auth persistence moved to AsyncStorage after users were logged out at random. Each is on
the Key decisions table.

## Related

- [What Pulse is for](what-pulse-is-for.md) — the goal this status is measured against
- [Next steps and backlog](next-steps-and-backlog.md) — what comes after the Play gate
