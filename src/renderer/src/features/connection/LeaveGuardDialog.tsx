// Pattern check: no GoF pattern (-) — rejected — presentational dialog over leaveGuardStore state; one mount point, no abstraction needed.
//
// The unsaved-changes prompt: shown while a leave (disconnect, back to the
// dongle, another node) waits on stores/leaveGuardStore. Closing it any other
// way (Esc, the overlay, ✕) is Cancel.
import { Loader2 } from 'lucide-react'
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
import useLeaveGuardStore from '@/stores/leaveGuardStore'

export function LeaveGuardDialog(): JSX.Element {
    const { deviceName, busy, choose } = useLeaveGuardStore(
        useShallow((s) => ({
            deviceName: s.deviceName,
            busy: s.busy,
            choose: s.choose,
        })),
    )
    const open = deviceName !== null

    return (
        <Dialog
            open={open}
            onOpenChange={(next): void => {
                if (!next) choose('cancel')
            }}
        >
            <DialogContent
                className="sm:max-w-md"
                showCloseButton={!busy}
                onEscapeKeyDown={(e): void => {
                    if (busy) e.preventDefault()
                }}
                onPointerDownOutside={(e): void => {
                    if (busy) e.preventDefault()
                }}
            >
                <DialogHeader>
                    <DialogTitle>Save changes to {deviceName}?</DialogTitle>
                    <DialogDescription>
                        Some changes are not saved on the device yet. Save them
                        before you leave, or discard them.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="ghost"
                        disabled={!!busy}
                        onClick={(): void => choose('cancel')}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        disabled={!!busy}
                        onClick={(): void => choose('discard')}
                    >
                        {busy === 'discard' && (
                            <Loader2 className="animate-spin" />
                        )}
                        Discard
                    </Button>
                    <Button
                        disabled={!!busy}
                        onClick={(): void => choose('save')}
                    >
                        {busy === 'save' && (
                            <Loader2 className="animate-spin" />
                        )}
                        {busy === 'save' ? 'Saving…' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
