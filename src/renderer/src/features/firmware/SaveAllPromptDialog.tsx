// Pattern check: no GoF pattern (-) — rejected — presentational dialog over
// saveAllPromptStore state; one mount point, no abstraction needed.
//
// Shown while a settings dialog's save waits on stores/saveAllPromptStore.
// Closing it any other way (Esc, the overlay, ✕) is Cancel.
import { useShallow } from 'zustand/react/shallow'

import { Button } from '@/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/ui/dialog'
import useSaveAllPromptStore from '@/stores/saveAllPromptStore'

export function SaveAllPromptDialog(): JSX.Element {
    const { deviceName, section, choose } = useSaveAllPromptStore(
        useShallow((s) => ({
            deviceName: s.deviceName,
            section: s.section,
            choose: s.choose,
        })),
    )
    return (
        <Dialog
            open={deviceName !== null}
            onOpenChange={(next): void => {
                if (!next) choose(false)
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Save all changes to {deviceName}?</DialogTitle>
                    <DialogDescription>
                        {deviceName} has other changes that are not saved yet,
                        such as key edits. The device saves everything at once,
                        so saving {section?.toLowerCase()} now saves those
                        changes too.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={(): void => choose(false)}>
                        Cancel
                    </Button>
                    <Button onClick={(): void => choose(true)}>Save all</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
