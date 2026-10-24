// Pattern check: no GoF pattern (-) — rejected — presentational section, one select per power timeout over the staged document; same idiom as RadioSection.
//
// When a battery device dims, sleeps and powers off (TBL_POWER). Each timeout
// is picked from a few durations or left to the device's default; on USB
// power nothing sleeps, whatever these say.
import { useEffect, useState, type JSX } from 'react'
import type { ConfigDevice } from '@firmware/config'
import type { DeviceConfigApi } from '@firmware/service'
import {
    type ConfigPowerSettings,
    POWER_FIELDS,
    type PowerField,
    powerTimeoutLabel,
} from '@firmware/config'
import { Label } from '@/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'
import { SettingsSection } from './SettingRows'
import { withPower } from './deviceForm'

const DEFAULT = 'default'

/** The durations to offer: the field's, plus the document's own value when it
 *  is none of them (set in the JSON), in order. */
function choicesOf(f: PowerField, current: number | undefined): number[] {
    if (current === undefined || f.choices.includes(current))
        return [...f.choices]
    return [...f.choices, current].sort((a, b) => a - b)
}

function TimeoutRow({
    field,
    value,
    disabled,
    onChange,
}: {
    field: PowerField
    value: number | undefined
    disabled?: boolean
    onChange: (value: number | undefined) => void
}): JSX.Element {
    const id = `power-${field.key}`
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Label htmlFor={id} className="w-40 shrink-0 text-xs">
                    {field.label}
                </Label>
                <Select
                    value={value === undefined ? DEFAULT : String(value)}
                    onValueChange={(v) =>
                        onChange(v === DEFAULT ? undefined : Number(v))
                    }
                    disabled={disabled}
                >
                    <SelectTrigger id={id} className="h-8 w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={DEFAULT}>
                            Default ({powerTimeoutLabel(field.defaultValue)})
                        </SelectItem>
                        {choicesOf(field, value).map((ms) => (
                            <SelectItem key={ms} value={String(ms)}>
                                {powerTimeoutLabel(ms)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <p className="pl-[10.5rem] text-caption text-muted-foreground">
                {field.description}
            </p>
        </div>
    )
}

export function PowerSection({
    value,
    onChange,
    disabled,
    powerOff,
}: {
    value: ConfigPowerSettings | undefined
    onChange: (power: ConfigPowerSettings | undefined) => void
    disabled?: boolean
    /** The device can power off and wake on an input: offer "Power off after". */
    powerOff: boolean
}): JSX.Element {
    const set = (key: PowerField['key'], v: number | undefined): void => {
        const next: ConfigPowerSettings = { ...value }
        if (v === undefined) delete next[key]
        else next[key] = v
        onChange(Object.keys(next).length ? next : undefined)
    }
    return (
        <SettingsSection
            title="Power"
            description="On battery, after no input for a while. On USB power nothing sleeps."
        >
            {POWER_FIELDS.filter((f) => powerOff || f.key !== 'offMs').map(
                (f) => (
                    <TimeoutRow
                        key={f.key}
                        field={f}
                        value={value?.[f.key]}
                        disabled={disabled}
                        onChange={(v) => set(f.key, v)}
                    />
                ),
            )}
        </SettingsSection>
    )
}

/** The power section on its own, over the device's staged document (a
 *  device whose other settings live elsewhere, like the joystick's). Absent
 *  until the device can stage a document. */
export function DevicePowerPanel({
    device,
    powerOff,
}: {
    device: DeviceConfigApi
    powerOff: boolean
}): JSX.Element | null {
    const draft = device.draft
    const [doc, setDoc] = useState<ConfigDevice | null>(
        () => draft?.get() ?? null,
    )
    useEffect(() => draft?.onChanged(setDoc), [draft])
    if (!draft || !doc) return null
    return (
        <PowerSection
            value={doc.power}
            onChange={(power) => draft.set(withPower(doc, power))}
            powerOff={powerOff}
        />
    )
}
