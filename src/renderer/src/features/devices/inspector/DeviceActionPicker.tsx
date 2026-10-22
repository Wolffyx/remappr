// Pattern check: no GoF pattern (-) — rejected — presentational frame (back, title) around the keyboard's KeyActionPicker, fed by the devicePicker adapter; one caller.
import { useMemo, type JSX } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { ActionId, ControlsCatalog } from '@firmware/devices/types'
import { KeyActionPicker } from '@/features/actions/KeyActionPicker'
import { devicePicker } from './devicePicker'

/** Assign an action to one binding slot of a control, with the same picker
 *  the keyboard editor uses. Stays open after a pick; Back closes it. */
export function DeviceActionPicker({
    title,
    value,
    catalog,
    onPick,
    onClose,
}: {
    title: string
    value: ActionId | null | undefined
    catalog: ControlsCatalog
    onPick: (id: ActionId | null) => void
    onClose: () => void
}): JSX.Element {
    const picker = useMemo(() => devicePicker(catalog), [catalog])
    const action = useMemo(() => picker.toKeyAction(value), [picker, value])
    return (
        <div className="absolute inset-0 z-20 flex flex-col bg-card animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
                <button
                    type="button"
                    aria-label="Back"
                    onClick={onClose}
                    className="grid size-[30px] place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                    <ArrowLeft className="size-[15px]" />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="text-panel-title font-bold">
                        Assign action
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                        {title}
                    </div>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-4">
                <KeyActionPicker
                    action={action}
                    actionTypes={picker.actionTypes}
                    layers={[]}
                    codec={picker.codec}
                    catalog={picker.catalog}
                    onChange={(draft) => {
                        const id = picker.fromDraft(draft)
                        if (id !== undefined) onPick(id)
                    }}
                />
            </div>
        </div>
    )
}
