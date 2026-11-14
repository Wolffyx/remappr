// Pattern check: no GoF pattern (-) — rejected — one prompt slice plus a shared
// in-flight promise, the same idiom as stores/leaveGuardStore.ts.
//
// "Save the other changes too?" — asked when a settings dialog saves while the
// device already holds other unsaved edits. A device saves its whole config at
// once, so the dialog's save would write those edits as well; the user decides
// instead of finding out afterwards.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface SaveAllPromptState {
    /** The device being saved while the prompt is open; null when closed. */
    deviceName: string | null
    /** What the dialog saves, e.g. "Power settings". */
    section: string | null
    choose: (saveAll: boolean) => void
}

let resolvePending: ((saveAll: boolean) => void) | null = null

const useSaveAllPromptStore = create<SaveAllPromptState>()(
    devtools(
        () => ({
            deviceName: null,
            section: null,
            choose: (saveAll: boolean): void => settle(saveAll),
        }),
        { name: 'saveAllPrompt' },
    ),
)

function settle(saveAll: boolean): void {
    const resolve = resolvePending
    resolvePending = null
    useSaveAllPromptStore.setState({ deviceName: null, section: null })
    resolve?.(saveAll)
}

/** Ask whether saving `section` may also save the device's other unsaved
 *  edits. Resolves true for "Save all", false for Cancel. A second ask while
 *  one is open cancels the first. */
export function askSaveAll(
    deviceName: string,
    section: string,
): Promise<boolean> {
    if (resolvePending) settle(false)
    return new Promise<boolean>((resolve) => {
        resolvePending = resolve
        useSaveAllPromptStore.setState({ deviceName, section })
    })
}

export default useSaveAllPromptStore
