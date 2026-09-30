// Pattern check: Decorator (Tier 2) — extended — a second Proxy over KeyboardService beside lib/saveMode.ts's withSaveMode; same interface, adds unlock-and-retry on LockedError.
//
// For firmwares with an 'actions' lock (Vial), the editor stays usable while
// the board is locked and only some operations are refused — the client throws
// LockedError for those (macro saves, assigning QK_BOOT, …). This wrapper turns
// that into a prompt: it asks the user to unlock (requestUnlock), then retries
// the call once. Every caller — key edits, encoder writes, a Save that flushes
// staged edits, macro saves — gets this without handling the lock itself.
//
// Firmwares with an 'editor' lock (ZMK) never reach the prompt: the app keeps
// the whole editor behind the locked overlay instead, and their LockedError
// passes through untouched.
import { LockedError } from '@firmware/errors'
import type { KeyboardService } from '@firmware/service'
import { requestUnlock } from '@/stores/unlockPromptStore'

function isLockedError(err: unknown): boolean {
    return (
        err instanceof LockedError ||
        (err as { code?: unknown } | null)?.code === 'LOCKED'
    )
}

function isThenable(value: unknown): value is Promise<unknown> {
    return typeof (value as { then?: unknown } | null)?.then === 'function'
}

export function withUnlockPrompt(service: KeyboardService): KeyboardService {
    const guard = (
        fn: (...args: unknown[]) => unknown,
        thisArg: unknown,
    ): ((...args: unknown[]) => unknown) =>
        function (...args: unknown[]): unknown {
            const result = Reflect.apply(fn, thisArg, args)
            if (!isThenable(result)) return result
            return result.catch(async (err: unknown) => {
                if (
                    !isLockedError(err) ||
                    service.capabilities.lock !== 'actions'
                ) {
                    throw err
                }
                if (!(await requestUnlock(service))) throw err
                return Reflect.apply(fn, thisArg, args)
            })
        }

    // Wrapped functions and facade objects, cached so repeated reads return
    // the same identity (callers memoize on them).
    const wrapped = new WeakMap<object, unknown>()

    const decorate = <T extends object>(target: T): T =>
        new Proxy(target, {
            get(obj, prop) {
                const value = Reflect.get(obj, prop)
                // Symbol keys are internal handles (withSaveMode's controls):
                // hand them through untouched.
                if (typeof prop === 'symbol') return value
                if (typeof value === 'function') {
                    let fn = wrapped.get(value)
                    if (!fn) {
                        fn = guard(value as (...a: unknown[]) => unknown, obj)
                        wrapped.set(value, fn)
                    }
                    return fn
                }
                // Facades (encoders, macros, dynamic, …) are plain objects of
                // methods; decorate them too so their writes get the prompt.
                if (
                    value &&
                    typeof value === 'object' &&
                    prop !== 'capabilities' &&
                    prop !== 'deviceInfo' &&
                    Object.values(value).some((v) => typeof v === 'function')
                ) {
                    let facade = wrapped.get(value)
                    if (!facade) {
                        facade = decorate(value)
                        wrapped.set(value, facade)
                    }
                    return facade
                }
                return value
            },
        })

    return decorate(service)
}
