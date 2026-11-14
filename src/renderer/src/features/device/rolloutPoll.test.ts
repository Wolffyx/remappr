// pattern-check: skip — assertions over the rollout poll's stop rule
import { describe, expect, it } from 'vitest'

import { MAX_POLL_FAILURES, rolloutPollGivesUp } from './rolloutPoll'

describe('rolloutPollGivesUp', () => {
    // L4.19: while a channel change was in progress, failing reads kept the
    // 1 s poll going forever.
    it('keeps polling through a few failed reads', () => {
        expect(rolloutPollGivesUp(0)).toBe(false)
        expect(rolloutPollGivesUp(MAX_POLL_FAILURES - 1)).toBe(false)
    })

    it('stops after the limit of failed reads in a row', () => {
        expect(rolloutPollGivesUp(MAX_POLL_FAILURES)).toBe(true)
    })
})
