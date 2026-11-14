// Pattern check: no GoF pattern (-) — rejected — an append-only file sink with
// one size-based rotation; plain functions.
//
// The production error log. Shipped builds keep console.warn and console.error
// (shared/logger) and this writes them, from the main process and from the
// renderer, to <logs>/remappr.log, so a failure in the field (a node list that
// will not come back, a HID read error) leaves a trace the user can send. The
// file rolls over to remappr.old.log past MAX_LOG_BYTES.
import * as fs from 'fs'
import * as path from 'path'
import { inspect } from 'util'

export const LOG_FILE_NAME = 'remappr.log'
export const OLD_LOG_FILE_NAME = 'remappr.old.log'
export const MAX_LOG_BYTES = 1024 * 1024

export type LogLevel = 'warn' | 'error'

export interface LogFile {
    readonly path: string
    write(level: LogLevel, source: string, args: readonly unknown[]): void
}

/** One message as a line: an Error with its stack, anything else inspected. */
export function formatLogArgs(args: readonly unknown[]): string {
    return args
        .map((a) => {
            if (typeof a === 'string') return a
            if (a instanceof Error) return a.stack ?? `${a.name}: ${a.message}`
            return inspect(a, { depth: 4, breakLength: Infinity })
        })
        .join(' ')
}

/** A log file in `dir`. Writes never throw: a full disk must not take the
 *  app down with it. */
export function openLogFile(
    dir: string,
    maxBytes: number = MAX_LOG_BYTES,
    now: () => Date = () => new Date(),
): LogFile {
    const file = path.join(dir, LOG_FILE_NAME)
    const old = path.join(dir, OLD_LOG_FILE_NAME)
    let size = -1

    const rollIfFull = (): void => {
        if (size < 0) {
            size = fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0
        }
        if (size < maxBytes) return
        fs.renameSync(file, old)
        size = 0
    }

    return {
        path: file,
        write(level, source, args): void {
            const line = `${now().toISOString()} ${level.toUpperCase()} [${source}] ${formatLogArgs(args)}\n`
            try {
                fs.mkdirSync(dir, { recursive: true })
                rollIfFull()
                fs.appendFileSync(file, line)
                size += Buffer.byteLength(line)
            } catch {
                // Nowhere left to report a failed log write.
            }
        },
    }
}

type ConsoleLike = Pick<Console, 'warn' | 'error'>

/** Send `c`'s warn and error to `log` too (they still reach the console). */
export function teeConsoleToLog(
    c: ConsoleLike,
    log: LogFile,
    source: string,
): void {
    const warn = c.warn.bind(c)
    const error = c.error.bind(c)
    c.warn = (...args: unknown[]): void => {
        log.write('warn', source, args)
        warn(...args)
    }
    c.error = (...args: unknown[]): void => {
        log.write('error', source, args)
        error(...args)
    }
}

/** A renderer console level as a log level; only warnings and errors are
 *  kept. */
export function rendererLogLevel(level: string): LogLevel | undefined {
    if (level === 'warning') return 'warn'
    if (level === 'error') return 'error'
    return undefined
}
