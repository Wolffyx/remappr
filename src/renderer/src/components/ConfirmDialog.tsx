// Pattern check: no GoF pattern (-) — rejected — promise-returning confirm hook
// over the existing Dialog primitive; one small component.
//
// The in-app replacement for window.confirm: `confirm(...)` opens a dialog and
// resolves true on the confirm button, false on Cancel, Esc, the overlay or ✕.
import { JSX, useCallback, useRef, useState } from 'react'

import { Button } from '@/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/ui/dialog'

export interface ConfirmOptions {
    title: string
    description: string
    /** The confirm button's text. */
    confirmLabel: string
    /** Draw the confirm button as destructive (it loses data or bonds). */
    destructive?: boolean
}

export interface UseConfirm {
    /** Ask; resolves true only when the user confirms. */
    confirm: (options: ConfirmOptions) => Promise<boolean>
    /** Render this once in the component that asks. */
    dialog: JSX.Element
}

export function useConfirm(): UseConfirm {
    const [asked, setAsked] = useState<ConfirmOptions | null>(null)
    const resolveRef = useRef<((ok: boolean) => void) | null>(null)

    const answer = useCallback((ok: boolean): void => {
        resolveRef.current?.(ok)
        resolveRef.current = null
        setAsked(null)
    }, [])

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        // A second ask while one is open answers the first with no.
        resolveRef.current?.(false)
        setAsked(options)
        return new Promise((resolve) => {
            resolveRef.current = resolve
        })
    }, [])

    const dialog = (
        <Dialog
            open={asked !== null}
            onOpenChange={(next): void => {
                if (!next) answer(false)
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{asked?.title}</DialogTitle>
                    <DialogDescription>{asked?.description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={(): void => answer(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant={asked?.destructive ? 'destructive' : 'default'}
                        onClick={(): void => answer(true)}
                    >
                        {asked?.confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )

    return { confirm, dialog }
}
