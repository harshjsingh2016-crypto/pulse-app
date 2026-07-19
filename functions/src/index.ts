import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { requestEmailOtp, verifyEmailOtp, deleteAccount } from './auth';
export { chatTurn, taskReviewTurn, domainStrategyTurn } from './chat';
export { executeAction } from './actions';
export { inferMacros } from './meals';
export { transcribeAudio } from './transcribe';
export { seedRecurringToday } from './scheduled';

// NOTE: New-user bootstrapping (user doc + default spend categories) is handled
// client-side in app/lib/userBootstrap.ts. A beforeUserCreated blocking function
// would require Google Cloud Identity Platform (GCIP), which this project does
// not use, so the logic lives on the client and runs on first sign-in instead.
