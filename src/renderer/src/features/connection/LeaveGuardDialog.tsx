// Pattern check: no GoF pattern (-) — rejected — presentational dialog over leaveGuardStore state; one mount point, no abstraction needed.
//
// The unsaved-changes prompt: shown while a leave (disconnect, back to the
// dongle, another node) waits on stores/leaveGuardStore. Closing it any other
// way (Esc, the overlay, ✕) is Cancel.
//
// In Electron, closing the window, quitting and the reload keys wait on this
// dialog too (windowLeaveGuard). What can't wait for it (a reload from the
// menu, closing or reloading a browser tab) gets the platform's own prompt:
// the browser's "Leave site?", or in Electron the main process's Leave /
// Stay box (will-prevent-unload).
import { useEffect } from 'react'
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
import useConnectionStore from '@/stores/connectionStore'
import useLeaveGuardStore, { unloadGuard } from '@/stores/leaveGuardStore'
import { getApi } from '@/electron/api'
import { installWindowLeaveGuard } from './windowLeaveGuard'

export function LeaveGuardDialog(): JSX.Element {
    const { deviceName, busy, choose } = useLeaveGuardStore(
        useShallow((s) => ({
            deviceName: s.deviceName,
            busy: s.busy,
            choose: s.choose,
        })),
    )
    const open = deviceName !== null

    useEffect(() => {
        const onBeforeUnload = unloadGuard(
            () => useConnectionStore.getState().service,
        )
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [])

    useEffect(() => {
        const api = getApi()
        if (!api) return
        return installWindowLeaveGuard(api)
    }, [])

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
