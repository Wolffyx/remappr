// pattern-check: skip — the keymap editor's header actions, composed from existing clusters.
import { Separator } from '@/ui/separator'
import { Settings } from '@/components/modals/Settings'
import { CommunityLinks } from './CommunityLinks'
import { HistoryTools } from './HistoryTools'
import { ToolbarSlot } from './ToolbarButton'

const SEPARATOR = 'mx-1 data-[orientation=vertical]:h-5'

/** History · project links · settings — the keymap editor's header actions.
 *  The editing tools themselves live in the floating toolbar over the board. */
export function KeymapHeaderActions(): JSX.Element {
    return (
        <>
            <HistoryTools />
            <Separator orientation="vertical" className={SEPARATOR} />
            <CommunityLinks />
            <Separator orientation="vertical" className={SEPARATOR} />
            <ToolbarSlot tooltip="Settings">
                <Settings />
            </ToolbarSlot>
        </>
    )
}
