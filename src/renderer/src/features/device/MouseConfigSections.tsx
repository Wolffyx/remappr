// Pattern check: no GoF pattern (-) — rejected — presentational sections, each
// editing one slice of the mouse page's draft; plain composition.
//
// The saved mouse settings (TBL_MOUSE, TBL_RADIO): pointer, acceleration curve,
// button map and the radio link. Each section edits the draft only; the page
// pushes the whole document on Save.
import type { JSX } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
    MOUSE_ACCEL_POINTS_MAX,
    MOUSE_BUTTON_NAMES,
    MOUSE_SCROLL_DIVISOR_FIELD,
    RADIO_FIELDS,
} from '@firmware/config'

import { cn } from '@/lib/cn'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

import type {
    ButtonChoice,
    CurvePointDraft,
    DpiRange,
    DraftErrors,
    MouseDraft,
    MouseFlag,
    RadioDraft,
} from './deviceForm'
import {
    NumberSettingRow,
    SettingsSection,
    SwitchSettingRow,
} from './SettingRows'

const FLAG_ROWS: { key: MouseFlag; label: string; description?: string }[] = [
    { key: 'invertX', label: 'Invert X' },
    { key: 'invertY', label: 'Invert Y' },
    { key: 'invertWheel', label: 'Invert wheel' },
    { key: 'invertHwheel', label: 'Invert horizontal wheel' },
    {
        key: 'swapXY',
        label: 'Swap X and Y',
        description: 'Applied before the inverts.',
    },
]

interface SectionProps<T> {
    value: T
    onChange: (value: T) => void
    errors: DraftErrors
    disabled: boolean
}

export function MousePointerSection({
    value,
    onChange,
    errors,
    disabled,
    range,
}: SectionProps<MouseDraft> & { range: DpiRange | null }): JSX.Element {
    return (
        <SettingsSection
            title="Pointer"
            description="Resolution, axis direction and wheel speed."
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <Label
                        htmlFor="mouse-cpi"
                        className="w-40 shrink-0 text-xs"
                    >
                        DPI
                    </Label>
                    <Input
                        id="mouse-cpi"
                        inputMode="numeric"
                        value={value.cpi}
                        placeholder="Sensor"
                        onChange={(e) =>
                            onChange({ ...value, cpi: e.target.value })
                        }
                        disabled={disabled}
                        aria-invalid={!!errors.cpi}
                        className={cn(
                            'h-8 w-28',
                            errors.cpi && 'border-destructive',
                        )}
                    />
                    {errors.cpi && (
                        <span className="text-[11px] text-destructive">
                            {errors.cpi}
                        </span>
                    )}
                </div>
                <p className="pl-[10.5rem] text-[11px] text-muted-foreground">
                    {range ? `${range.min}–${range.max}. ` : ''}
                    Empty = the sensor&apos;s own resolution.
                </p>
            </div>
            {FLAG_ROWS.map((f) => (
                <SwitchSettingRow
                    key={f.key}
                    id={`mouse-${f.key}`}
                    label={f.label}
                    description={f.description}
                    checked={value.flags[f.key]}
                    disabled={disabled}
                    onChange={(on) =>
                        onChange({
                            ...value,
                            flags: { ...value.flags, [f.key]: on },
                        })
                    }
                />
            ))}
            <NumberSettingRow
                field={MOUSE_SCROLL_DIVISOR_FIELD}
                value={value.scrollDivisor}
                error={errors.scrollDivisor}
                disabled={disabled}
                onChange={(v) => onChange({ ...value, scrollDivisor: v })}
            />
        </SettingsSection>
    )
}

export function MouseCurveSection({
    value,
    onChange,
    errors,
    disabled,
}: SectionProps<CurvePointDraft[]>): JSX.Element {
    const set = (i: number, patch: Partial<CurvePointDraft>): void =>
        onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)))
    const full = value.length >= MOUSE_ACCEL_POINTS_MAX
    return (
        <SettingsSection
            title="Acceleration curve"
            description="Above each input speed (counts per report), motion is scaled by its percentage; 100 % = unchanged. No points = flat."
            actions={
                <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled || full}
                    title={
                        full
                            ? `At most ${MOUSE_ACCEL_POINTS_MAX} points`
                            : undefined
                    }
                    onClick={() => {
                        const last = value[value.length - 1]
                        const speed = last
                            ? String(Number(last.speed || 0) + 10)
                            : '0'
                        onChange([...value, { speed, percent: '100' }])
                    }}
                >
                    <Plus className="mr-1.5 size-3.5" />
                    Add point
                </Button>
            }
        >
            {value.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Flat: no points.
                </p>
            ) : (
                <div className="flex flex-col gap-1.5">
                    <div className="flex gap-2 text-[11px] text-muted-foreground">
                        <span className="w-28">Speed from</span>
                        <span className="w-28">Multiplier</span>
                    </div>
                    {value.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <Input
                                aria-label={`Point ${i + 1} speed`}
                                inputMode="numeric"
                                value={p.speed}
                                onChange={(e) =>
                                    set(i, { speed: e.target.value })
                                }
                                disabled={disabled}
                                className="h-8 w-28"
                            />
                            <Input
                                aria-label={`Point ${i + 1} multiplier`}
                                inputMode="numeric"
                                value={p.percent}
                                onChange={(e) =>
                                    set(i, { percent: e.target.value })
                                }
                                disabled={disabled}
                                className="h-8 w-20"
                            />
                            <span className="text-[10.5px] text-muted-foreground">
                                %
                            </span>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                title="Remove point"
                                disabled={disabled}
                                onClick={() =>
                                    onChange(value.filter((_, j) => j !== i))
                                }
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            {errors.curve && (
                <p className="text-[11px] text-destructive">{errors.curve}</p>
            )}
        </SettingsSection>
    )
}

const OFF = 'off'

export function MouseButtonsSection({
    value,
    onChange,
    disabled,
}: Omit<SectionProps<ButtonChoice[]>, 'errors'>): JSX.Element {
    return (
        <SettingsSection
            title="Buttons"
            description="What each physical button reports as. Off = the button sends nothing."
        >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MOUSE_BUTTON_NAMES.map((name, i) => (
                    <div key={name} className="flex items-center gap-2">
                        <Label className="w-24 shrink-0 text-xs">{name}</Label>
                        <Select
                            value={String(value[i])}
                            disabled={disabled}
                            onValueChange={(v) =>
                                onChange(
                                    value.map((b, j) =>
                                        j === i
                                            ? v === OFF
                                                ? OFF
                                                : Number(v)
                                            : b,
                                    ),
                                )
                            }
                        >
                            <SelectTrigger
                                className={cn(
                                    'h-8 w-36',
                                    value[i] !== i && 'border-primary/60',
                                )}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MOUSE_BUTTON_NAMES.map((out, j) => (
                                    <SelectItem key={out} value={String(j)}>
                                        {out}
                                    </SelectItem>
                                ))}
                                <SelectItem value={OFF}>Off</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
        </SettingsSection>
    )
}

export function RadioSection({
    value,
    onChange,
    errors,
    disabled,
}: SectionProps<RadioDraft>): JSX.Element {
    return (
        <SettingsSection
            title="2.4 GHz link"
            description="How the mouse talks to its dongle."
        >
            <SwitchSettingRow
                id="radio-auto-pair"
                label="Pair on its own"
                description="While the mouse has no dongle bond it looks for an open pairing window by itself. Off: pairing waits for an explicit request."
                checked={value.autoPair}
                disabled={disabled}
                onChange={(autoPair) => onChange({ ...value, autoPair })}
            />
            {RADIO_FIELDS.map((f) => (
                <NumberSettingRow
                    key={f.key}
                    field={f}
                    value={value.numbers[f.key]}
                    error={errors[f.key]}
                    disabled={disabled}
                    onChange={(v) =>
                        onChange({
                            ...value,
                            numbers: { ...value.numbers, [f.key]: v },
                        })
                    }
                />
            ))}
        </SettingsSection>
    )
}
