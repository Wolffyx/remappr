/**
 * Namespaced logger factory.
 *
 * Default policy: dev = log everything to console; prod = warnings and
 * errors only (the main process also writes them to a log file, see
 * main/logFile.ts), debug and info silent.
 * Used in both main + renderer (Electron), so the dev check covers
 * `import.meta.env.DEV` (Vite/electron-vite injected) and
 * `process.env.NODE_ENV !== 'production'` (Node fallback).
 *
 * Single seam means future Sentry / file-based transport is one
 * edit here — no callers change.
 */

type LogFn = (...args: unknown[]) => void

export interface Logger {
    debug: LogFn
    info: LogFn
    warn: LogFn
    error: LogFn
}

const noop: LogFn = () => {}

const isDev = ((): boolean => {
    try {
        // Vite / electron-vite inject import.meta.env at build time.
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            return import.meta.env.DEV === true
        }
    } catch {
        /* ignore — `import.meta` may not exist in plain Node */
    }
    return (
        typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'
    )
})()

export function createLogger(namespace: string): Logger {
    const prefix = `[${namespace}]`
    // Read console at call time: the main process tees warn and error to
    // its log file after this logger is made.
    const warn: LogFn = (...args) => console.warn(prefix, ...args)
    const error: LogFn = (...args) => console.error(prefix, ...args)
    if (!isDev) return { debug: noop, info: noop, warn, error }
    return {
        debug: (...args) => console.debug(prefix, ...args),
        info: (...args) => console.log(prefix, ...args),
        warn,
        error,
    }
}

/** Quiet `c`'s chatty levels (log, info, debug). Warnings and errors stay:
 *  they are how a failure in a shipped build gets noticed. */
export function quietConsole(c: Pick<Console, 'log' | 'info' | 'debug'>): void {
    c.log = noop
    c.info = noop
    c.debug = noop
}

/**
 * Quiet native console.log/info/debug in production builds. Call once at
 * each entry point (Electron main + renderer). console.warn and console.error
 * stay on, and the main process writes both (its own and the renderer's) to
 * the log file.
 *
 * Dev (electron-vite dev / vite dev) keeps full logging.
 */
export function silenceConsoleInProduction(): void {
    if (isDev) return
    quietConsole(console)
}

/** Whether this build logs everything (dev) or only warnings and errors. */
export const isDevBuild = (): boolean => isDev
