// Pattern check: no GoF pattern (-) — rejected — presentational composition of an
// existing Popover + KeycodePickerGrid + HidUsageLabel behind a value/onChange
// field; the raw↔packed HID conversion is local glue mirroring dynamicBridge.
//
// A compact, by-name keycode field for the §24 dynamic editors (tap-dance slots,
// macro steps), replacing the raw hex/number inputs. Shows the current key's name
// (HidUsageLabel) and opens the shared KeycodePickerGrid to choose a new one. The
// grid reads the connected device's codec + catalog from the store, so no props
// are threaded here.
import { useState } from 'react'

import { HidUsageLabel } from '@/features/keymap/keyboard/HidUsageLabel'
import { KeycodePickerGrid } from '@/features/keymap/keycode-picker/KeycodePickerGrid'
import { Button } from '@/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'

const HID_PAGE_KEYBOARD = 0x07

// Dynamic entries store keycodes as raw HID usages (keyboard page implied), while
// the picker + HidUsageLabel speak the codec's packed (page<<16)|usage. Convert at
// the boundary — same rule as dynamicBridge's keyOfUsage / usageOfKey (&0xffff).
const rawToPacked = (raw: number): number =>
    raw > 0 && raw < 1 << 16 ? (HID_PAGE_KEYBOARD << 16) | raw : raw
const packedToRaw = (packed?: number): number => (packed ?? 0) & 0xffff

export function KeycodeField({
    value,
    onChange,
    disabled = false,
}: {
    value: number
    onChange: (raw: number) => void
    disabled?: boolean
}): JSX.Element {
    const [open, setOpen] = useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    className="h-8 min-w-16 px-2"
                    aria-label="Choose keycode"
                >
                    {value ? (
                        <HidUsageLabel hid_usage={rawToPacked(value)} />
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            None
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
                <KeycodePickerGrid
                    value={rawToPacked(value)}
                    onValueChanged={(v) => onChange(packedToRaw(v))}
                />
            </PopoverContent>
        </Popover>
    )
}
