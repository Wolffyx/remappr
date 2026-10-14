// Pattern check: no GoF pattern (-) — rejected — one async entry point for Try Demo, moved out of App.tsx so the start page and the device editor's "Switch device" share it.
import { toast } from 'sonner'
import {
    connectDemoDevice,
    type DemoDeviceId,
    type MockServiceOptions,
} from '@firmware'
import { withUnlockPrompt } from '@/lib/unlockPrompt'
import { openService } from '../openService'

/** Dev only: `?demoLock=actions` (Vial-style) or `?demoLock=editor`
 *  (ZMK-style) starts the demo keyboards locked, to try the unlock UI. */
function demoLockOptions(): MockServiceOptions | undefined {
    if (!import.meta.env.DEV) return undefined
    const kind = new URLSearchParams(window.location.search).get('demoLock')
    if (kind === 'actions') return { lock: 'actions', initiallyLocked: true }
    if (kind !== 'editor') return undefined
    return { lock: 'editor', initiallyLocked: true, deviceUnlockAfterMs: 5_000 }
}

/** Dev only: `?demoDevice=<id>` picks the device Try Demo opens. */
export function demoDeviceFromUrl(): DemoDeviceId | null {
    if (!import.meta.env.DEV) return null
    return new URLSearchParams(window.location.search).get(
        'demoDevice',
    ) as DemoDeviceId | null
}

/** Open the demo device `id`, closing whatever is connected first so its edit
 *  history never carries over to the next device. */
export async function connectDemo(id: DemoDeviceId): Promise<void> {
    try {
        await openService(async () =>
            withUnlockPrompt(await connectDemoDevice(id, demoLockOptions())),
        )
    } catch (err) {
        toast.error('Failed to start demo mode.', {
            description: err instanceof Error ? err.message : String(err),
        })
    }
}
