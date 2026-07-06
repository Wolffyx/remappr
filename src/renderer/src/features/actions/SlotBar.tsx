// Pattern check: no GoF pattern (-) — rejected — small presentational chip-row, no abstraction warranted.
// pattern-check: skip a11y refactor: split nested button into siblings + handler
import { Button } from '@/ui/button'
import { HidUsageLabel } from '@/features/keymap/keyboard/HidUsageLabel'
import { X } from 'lucide-react'

export type SlotKind = 'hid' | 'layer' | 'plain'

export interface SlotDescriptor {
    // pattern-check: skip additive optional field on existing descriptor
    id: string
    label: string
    value?: number
    /** Text to show instead of the raw value — e.g. an enum command's label
     *  ("BT_SEL") rather than its number (3). */
    valueLabel?: string
    kind?: SlotKind
    layerName?: string
    inactiveBorderClass?: string
    onRemove?: () => void
    disabled?: boolean
    disabledHint?: string
}

interface SlotBarProps {
    slots: SlotDescriptor[]
    activeSlotId?: string
    onActivate?: (id: string) => void
}

function SlotValue({ slot }: { slot: SlotDescriptor }): JSX.Element {
    // Value 0 is "unset" for hid/layer slots (no key / layer 0), but a valid
    // pick for an enum command with a label — show the label in that case.
    if (
        slot.value === undefined ||
        (slot.value === 0 && slot.valueLabel === undefined)
    ) {
        return <span className="text-xs text-muted-foreground italic">—</span>
    }
    if (slot.kind === 'layer') {
        return (
            <span className="text-sm">
                {slot.layerName ?? `L${slot.value}`}
            </span>
        )
    }
    if (slot.kind === 'hid') {
        return (
            <span className="text-sm">
                <HidUsageLabel hid_usage={slot.value} />
            </span>
        )
    }
    return <span className="text-sm">{slot.valueLabel ?? slot.value}</span>
}

export function SlotBar({
    slots,
    activeSlotId,
    onActivate,
}: SlotBarProps): JSX.Element {
    return (
        <div className="flex flex-row flex-wrap gap-2 items-center">
            {slots.map((slot) => {
                const isActive = slot.id === activeSlotId
                const inactive = slot.inactiveBorderClass ?? 'border-border'
                const ringClass = isActive
                    ? 'ring-2 ring-primary border-primary'
                    : inactive
                const hasValue = slot.value !== undefined && slot.value !== 0
                const showRemove = slot.onRemove && hasValue
                return (
                    <div
                        key={slot.id}
                        className={`group flex items-center gap-1 rounded-md border-2 bg-card transition-colors ${ringClass} ${
                            slot.disabled ? 'opacity-50' : ''
                        }`}
                    >
                        <button
                            type="button"
                            disabled={slot.disabled}
                            onClick={() =>
                                !slot.disabled && onActivate?.(slot.id)
                            }
                            title={
                                slot.disabled ? slot.disabledHint : undefined
                            }
                            className={`flex items-center gap-2 px-3 py-1.5 ${
                                slot.disabled
                                    ? 'cursor-not-allowed'
                                    : 'cursor-pointer hover:bg-accent/30'
                            }`}
                        >
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                {slot.label}
                            </span>
                            <span className="min-w-[2.5em] text-foreground">
                                <SlotValue slot={slot} />
                            </span>
                        </button>
                        {showRemove && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${slot.label}`}
                                onClick={() => slot.onRemove?.()}
                                className="h-5 w-5 p-0 mr-1"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
