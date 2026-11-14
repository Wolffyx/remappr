// pattern-check: skip — async try/catch wrapper with toast side-effects
import { toast } from 'sonner'
import { describeDeviceError } from './deviceErrorText'

/** Show a failed device operation as a toast the user can act on: the
 *  prefixed message, and the remediation hint (with the raw device status)
 *  as its description. */
export function toastDeviceError(errorPrefix: string, e: unknown): void {
    const { message, hint } = describeDeviceError(e)
    toast.error(`${errorPrefix}: ${message}`, hint ? { description: hint } : {})
}

export async function saveWithToast<T>(
    fn: () => Promise<T>,
    successMsg: string | null,
    errorPrefix: string,
): Promise<T | undefined> {
    try {
        const r = await fn()
        if (successMsg) toast.success(successMsg)
        return r
    } catch (e) {
        toastDeviceError(errorPrefix, e)
        console.error(e)
        return undefined
    }
}

/** saveWithToast for a setter that resolves to nothing: true once it
 *  succeeded. Checking saveWithToast's result for `undefined` cannot tell a
 *  `Promise<void>` success from a failure. */
export async function saveSucceeded(
    fn: () => Promise<unknown>,
    successMsg: string | null,
    errorPrefix: string,
): Promise<boolean> {
    const ok = await saveWithToast(
        async () => {
            await fn()
            return true
        },
        successMsg,
        errorPrefix,
    )
    return ok === true
}
