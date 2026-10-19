// Only in memory: invitation secrets are never persisted with profile/preferences.
let pending: string | undefined;
export const pendingInvitation = { get: () => pending, set: (value: string | undefined) => { pending = value; } };
