// pattern-check: skip — assertions over the production log file sink
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    formatLogArgs,
    LOG_FILE_NAME,
    OLD_LOG_FILE_NAME,
    openLogFile,
    rendererLogLevel,
    teeConsoleToLog,
} from './logFile'

const at = (): Date => new Date('2026-11-14T10:00:00.000Z')

describe('openLogFile', () => {
    let dir: string
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remappr-log-'))
    })
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true })
    })

    // L4.17: shipped builds dropped every log call, console.error included,
    // and wrote nothing to a file.
    it('appends a timestamped line per message', () => {
        const log = openLogFile(dir, 1024 * 1024, at)
        log.write('error', 'hid', ['read failed:', new Error('EIO')])
        log.write('warn', 'renderer', ['Failed to list nodes'])

        const text = fs.readFileSync(path.join(dir, LOG_FILE_NAME), 'utf8')
        const lines = text.trimEnd().split('\n')
        expect(lines[0]).toMatch(
            /^2026-11-14T10:00:00.000Z ERROR \[hid\] read failed: Error: EIO/,
        )
        expect(lines.at(-1)).toBe(
            '2026-11-14T10:00:00.000Z WARN [renderer] Failed to list nodes',
        )
    })

    it('rolls over to the old file once full', () => {
        const log = openLogFile(dir, 80, at)
        log.write('error', 'main', ['a'.repeat(60)])
        log.write('error', 'main', ['second'])

        const old = fs.readFileSync(path.join(dir, OLD_LOG_FILE_NAME), 'utf8')
        const cur = fs.readFileSync(path.join(dir, LOG_FILE_NAME), 'utf8')
        expect(old).toContain('a'.repeat(60))
        expect(cur).toContain('second')
        expect(cur).not.toContain('a'.repeat(60))
    })

    it('never throws when the folder cannot be written', () => {
        const blocker = path.join(dir, 'file')
        fs.writeFileSync(blocker, '')
        const log = openLogFile(path.join(blocker, 'logs'), 1024, at)
        expect(() => log.write('error', 'main', ['x'])).not.toThrow()
    })
})

describe('teeConsoleToLog', () => {
    it('writes warn and error to the log and still prints them', () => {
        const printed: unknown[][] = []
        const c = {
            warn: (...a: unknown[]): void => void printed.push(a),
            error: (...a: unknown[]): void => void printed.push(a),
        }
        const write = vi.fn()
        teeConsoleToLog(c, { path: '', write }, 'main')

        c.warn('w', 1)
        c.error('e')

        expect(write.mock.calls).toEqual([
            ['warn', 'main', ['w', 1]],
            ['error', 'main', ['e']],
        ])
        expect(printed).toEqual([['w', 1], ['e']])
    })
})

describe('rendererLogLevel / formatLogArgs', () => {
    it('keeps only renderer warnings and errors', () => {
        expect(rendererLogLevel('warning')).toBe('warn')
        expect(rendererLogLevel('error')).toBe('error')
        expect(rendererLogLevel('info')).toBeUndefined()
        expect(rendererLogLevel('debug')).toBeUndefined()
    })

    it('inspects objects on one line', () => {
        expect(formatLogArgs(['n', { a: 1 }])).toBe('n { a: 1 }')
    })
})
