// pattern-check: skip — the keymap editor's three tool clusters, moved out of Header so other editors can bring their own.
import { Separator } from '@/ui/separator'
import { ViewTools } from './ViewTools'
import { ConfigTools } from './ConfigTools'
import { HistoryTools } from './HistoryTools'

const SEPARATOR = 'mx-1 data-[orientation=vertical]:h-5'

/** View · config · history — the keymap editor's toolbar. */
export function KeymapToolClusters(): JSX.Element {
    return (
        <>
            <ViewTools />
            <Separator orientation="vertical" className={SEPARATOR} />
            <ConfigTools />
            <Separator orientation="vertical" className={SEPARATOR} />
            <HistoryTools />
        </>
    )
}
