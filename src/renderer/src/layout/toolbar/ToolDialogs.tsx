// pattern-check: skip — render loop over the existing dialog table
//
// The toolbar's dialogs, mounted once for the editor. Whichever toolbar style
// is on (or the search palette) only sets toolDialogStore.open; each dialog
// mounts on first open and stays mounted after, as it did in the header.
import { lazy } from 'react'

import { MountOnDemand } from '@/components/MountOnDemand'
import { Download } from '@/components/modals/Download'
import useLoadStatsStore from '@/stores/loadStatsStore'
import useToolDialogStore from '@/stores/toolDialogStore'
import { TOOLBAR_MODALS } from './ToolbarModals'
import { useToolHousekeeping } from './tools'

const LoadStatsModal = lazy(() =>
    import('@/features/keymap/keyboard/LoadStatsModal').then((m) => ({
        default: m.LoadStatsModal,
    })),
)

export function ToolDialogs(): JSX.Element {
    useToolHousekeeping()
    const open = useToolDialogStore((s) => s.open)
    const close = useToolDialogStore((s) => s.close)
    const loadOpen = useLoadStatsStore((s) => s.open)
    const setLoadOpen = useLoadStatsStore((s) => s.setOpen)

    return (
        <>
            {TOOLBAR_MODALS.map(({ id, Modal }) => (
                <MountOnDemand key={id} when={open === id}>
                    <Modal opened={open === id} onClose={close} />
                </MountOnDemand>
            ))}
            <MountOnDemand when={open === 'export'}>
                <Download opened={open === 'export'} onClose={close} />
            </MountOnDemand>
            <MountOnDemand when={loadOpen}>
                <LoadStatsModal
                    opened={loadOpen}
                    onClose={(): void => setLoadOpen(false)}
                />
            </MountOnDemand>
        </>
    )
}
