// Pattern check: no GoF pattern (-) — rejected — dispatches by slot.kind to existing renderers (HID/layer/enum/number); no abstraction needed.
import type { ActionSlot } from '@firmware/types'
import type { KeycodeCodec } from '@firmware/codec'
import type { KeyCatalog } from '@firmware/catalog/types'
import { KeycodePickerGrid } from '@/features/keymap/keycode-picker/KeycodePickerGrid'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'
import { Label } from '@/ui/label'
import { Input } from '@/ui/input'

// pattern-check: skip additive optional codec prop forwarded to the grid
export interface SlotValuePickerProps {
    slot: ActionSlot
    value?: number
    layers: { id: number; name: string }[]
    highlightedKeys?: number[]
    onChange: (value?: number) => void
    onActionChosen?: (kind: string) => void
    codec?: KeycodeCodec
    catalog?: KeyCatalog
}

export const SlotValuePicker = ({
    slot,
    value,
    layers,
    highlightedKeys,
    onChange,
    onActionChosen,
    codec,
    catalog,
}: SlotValuePickerProps): JSX.Element | null => {
    if (slot.kind === 'hid') {
        return (
            <KeycodePickerGrid
                onValueChanged={onChange}
                onActionChosen={onActionChosen}
                label={slot.label}
                value={value}
                highlightedKeys={highlightedKeys}
                codec={codec}
                catalog={catalog}
            />
        )
    }

    if (slot.kind === 'layer') {
        return (
            <>
                <Label htmlFor="slotValuePickerLayer">{slot.label}:</Label>
                <Select
                    onValueChange={(e) => onChange(parseInt(e))}
                    value={value?.toString()}
                >
                    <SelectTrigger
                        id="slotValuePickerLayer"
                        className="w-[180px]"
                    >
                        <SelectValue placeholder="Layer" />
                    </SelectTrigger>
                    <SelectContent>
                        {layers.map(({ id, name }) => (
                            <SelectItem key={id} value={id.toString()}>
                                {name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </>
        )
    }

    if (slot.kind === 'number' && slot.range) {
        const range = slot.range
        const span = range.max - range.min
        // Small enumerable ranges (e.g. a BT profile index) render as a
        // dropdown of every valid value — clearer than a free-form box and it
        // can't hold an out-of-range entry. Wide ranges fall back to input.
        if (span >= 0 && span <= 32) {
            const options = Array.from(
                { length: span + 1 },
                (_, i) => range.min + i,
            )
            return (
                <>
                    <Label htmlFor="slotValuePickerRange">{slot.label}:</Label>
                    <Select
                        onValueChange={(e) => onChange(parseInt(e))}
                        value={value?.toString()}
                    >
                        <SelectTrigger
                            id="slotValuePickerRange"
                            className="w-[180px]"
                        >
                            <SelectValue placeholder={slot.label} />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map((n) => (
                                <SelectItem key={n} value={n.toString()}>
                                    {n}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </>
            )
        }
        return (
            <>
                <Label htmlFor="slotValuePickerRange">{slot.label}: </Label>
                <Input
                    id="slotValuePickerRange"
                    type="number"
                    min={range.min}
                    max={range.max}
                    value={value ?? ''}
                    onChange={(e) => onChange(parseInt(e.target.value))}
                />
            </>
        )
    }

    if (
        (slot.kind === 'enum' || slot.kind === 'modifier') &&
        slot.values &&
        slot.values.length > 0
    ) {
        return (
            <Select
                onValueChange={(e) => onChange(parseInt(e))}
                value={value?.toString()}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={slot.label} />
                </SelectTrigger>
                <SelectContent>
                    {slot.values.map((v) => (
                        <SelectItem key={v.value} value={v.value.toString()}>
                            {v.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        )
    }

    if (slot.kind === 'action') {
        return (
            <p className="text-xs text-muted-foreground italic">
                Nested action picker not yet implemented.
            </p>
        )
    }

    return <p>Unsupported slot configuration.</p>
}
