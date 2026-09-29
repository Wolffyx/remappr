// Pattern check: no GoF pattern (-) — rejected — shared presentational 1u preview replacing two duplicated inline KeyButton wrappers.
import { KeyButton } from './KeyButton'
import type { KeyPosition } from './PhysicalLayoutCanvas'

/** A selected key's cap drawn as a 1u square, whatever its size on the board:
 *  a 6.25u spacebar would otherwise spill out of the summary card. */
export function KeyCapPreview({ info }: { info: KeyPosition }): JSX.Element {
    return (
        <div className="relative size-12 shrink-0">
            <KeyButton oneU={48} selected {...info} width={1} height={1} />
        </div>
    )
}
