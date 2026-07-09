// Pattern check: no GoF pattern (-) — rejected — DRYs three near-identical
// Selects into one presentational component fed by a pure kind→config lookup;
// data-driven dispatch over slot.kind, not polymorphic Strategy/Factory classes.
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
import { LegendGlyph } from '@/features/keymap/keyboard/LegendGlyph'
import {
    type SelectConfig,
    type SelectOption,
    selectConfigForSlot,
} from './selectConfigForSlot'

// The closed trigger face: behavior icon + selected command icon + label, inline.
// Both icons resolve against the renderer registry; an unknown id shows nothing.
// The command icon is dropped when it duplicates the behavior icon (e.g. &bt
// "Select Profile" is itself bluetooth) so the trigger never shows two of it.
function OptionFace({
    typeIcon,
    icon,
    label,
}: {
    typeIcon?: string
    icon?: string
    label: React.ReactNode
}): JSX.Element {
    const cmdIcon = icon !== typeIcon ? icon : undefined
    return (
        <span className="inline-flex items-center gap-1.5">
            <LegendGlyph id={typeIcon} className="h-4 w-4 shrink-0" />
            <LegendGlyph id={cmdIcon} className="h-4 w-4 shrink-0" />
            <span>{label}</span>
        </span>
    )
}

// A dropdown list row, laid out as a two-column table: a narrow fixed icon
// gutter and an auto-width text column. The gutter shows the option's own
// command icon, falling back to the behavior icon so icon-less commands still
// read and every row's text left-edge aligns (issue #147). The column is
// `auto`, not `1fr` — Radix wraps the row in an inline `ItemText`, so a `1fr`
// track collapses to min-content and truncates the text to nothing; sizing to
// content lets the popover grow to the widest label instead.
function OptionRow({
    icon,
    label,
}: {
    icon?: string
    label: React.ReactNode
}): JSX.Element {
    return (
        <span className="inline-grid grid-cols-[1.1rem_auto] items-center gap-2">
            <LegendGlyph id={icon} className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
        </span>
    )
}

// One Select for every value-list slot. The chosen option's label is passed as
// explicit SelectValue children on purpose: Radix otherwise fills the trigger
// only from a mounted item, so a seeded, never-opened value (notably 0) renders
// blank. Rendering it ourselves keeps the trigger correct without an open.
// pattern-check: skip — presentational render swap, wraps existing options in OptionFace
function ValueSelect({
    value,
    onChange,
    options,
    placeholder,
    id,
    label,
    typeIcon,
}: SelectConfig & {
    value?: number
    onChange: (value?: number) => void
}): JSX.Element {
    const selected = options.find((o) => o.value === value)
    const select = (
        <Select
            onValueChange={(e) => onChange(parseInt(e))}
            value={value?.toString()}
        >
            <SelectTrigger id={id} className="w-[180px]">
                <SelectValue placeholder={placeholder}>
                    {selected ? (
                        <OptionFace
                            typeIcon={typeIcon}
                            icon={selected.icon}
                            label={selected.label}
                        />
                    ) : (
                        value?.toString()
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {options.map((o: SelectOption) => (
                    <SelectItem
                        key={o.value}
                        value={o.value.toString()}
                        hideIndicator
                    >
                        <OptionRow icon={o.icon ?? typeIcon} label={o.label} />
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
    if (!label) return select
    return (
        <>
            <Label htmlFor={id}>{label}:</Label>
            {select}
        </>
    )
}

// pattern-check: skip additive optional codec prop forwarded to the grid
// pattern-check: skip additive optional typeIcon prop forwarded to the enum config
export interface SlotValuePickerProps {
    slot: ActionSlot
    value?: number
    layers: { id: number; name: string }[]
    highlightedKeys?: number[]
    onChange: (value?: number) => void
    onActionChosen?: (kind: string, params?: number[]) => void
    codec?: KeycodeCodec
    catalog?: KeyCatalog
    /** Owning behavior's icon id, shown before each enum option (issue #147). */
    typeIcon?: string
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
    typeIcon,
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

    const config = selectConfigForSlot(slot, layers, typeIcon)
    if (config) {
        return <ValueSelect {...config} value={value} onChange={onChange} />
    }

    if (slot.kind === 'number' && slot.range) {
        // Wide range — no enumerable dropdown; fall back to a free numeric box.
        return (
            <>
                <Label htmlFor="slotValuePickerRange">{slot.label}: </Label>
                <Input
                    id="slotValuePickerRange"
                    type="number"
                    min={slot.range.min}
                    max={slot.range.max}
                    value={value ?? ''}
                    onChange={(e) => onChange(parseInt(e.target.value))}
                />
            </>
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
