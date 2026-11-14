// pattern-check: skip — assertions over the production console policy
import { describe, expect, it } from 'vitest'

import { quietConsole } from './logger'

describe('quietConsole', () => {
    // L4.17: production silenced console.warn and console.error too.
    it('quiets log, info and debug but keeps warn and error', () => {
        const warn = (): void => {}
        const error = (): void => {}
        const log = (): void => {}
        const c = { log, info: log, debug: log, warn, error }

        quietConsole(c)

        expect(c.log).not.toBe(log)
        expect(c.info).not.toBe(log)
        expect(c.debug).not.toBe(log)
        expect(c.warn).toBe(warn)
        expect(c.error).toBe(error)
    })
})
