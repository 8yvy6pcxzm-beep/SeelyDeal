/** Lite is the free-trial plan (see lib/plan.ts) — it runs for TRIAL_DAYS from signup, then locks out until upgrade. */
export const TRIAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function trialEndsAt(companyCreatedAt: string): Date {
  return new Date(new Date(companyCreatedAt).getTime() + TRIAL_DAYS * DAY_MS);
}

export function trialDaysLeft(companyCreatedAt: string): number {
  const msLeft = trialEndsAt(companyCreatedAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(msLeft / DAY_MS));
}

export function isTrialExpired(companyCreatedAt: string): boolean {
  return Date.now() >= trialEndsAt(companyCreatedAt).getTime();
}
