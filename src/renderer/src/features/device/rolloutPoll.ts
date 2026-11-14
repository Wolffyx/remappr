// Pattern check: no GoF pattern (-) — rejected — one threshold rule as a function.

/** Reads in a row that may fail before the panel stops polling a channel
 *  rollout: the dongle is gone or busy, and Refresh reads again. */
export const MAX_POLL_FAILURES = 5

/** Whether `failures` reads in a row failing should stop the rollout poll. */
export const rolloutPollGivesUp = (failures: number): boolean =>
    failures >= MAX_POLL_FAILURES
