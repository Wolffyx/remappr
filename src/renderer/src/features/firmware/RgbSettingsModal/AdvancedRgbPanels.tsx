// pattern-check: skip — thin view composing MixedPanel for advanced raw-byte edits, no abstraction
import useConnectionStore from '@/stores/connectionStore'

import { MixedPanel } from './MixedPanel'

/** Raw Mix-region byte editors (advanced; connected boards only). Indicators
 *  now have a friendly editor in the Indicator lights tab. */
export function AdvancedPanels(): JSX.Element {
    const rgb = useConnectionStore((s) => s.service?.rgb)

    if (!rgb) {
        return (
            <div className="text-xs text-muted-foreground">
                Advanced raw-byte controls need a connected keyboard.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <MixedPanel rgb={rgb} />
        </div>
    )
}
