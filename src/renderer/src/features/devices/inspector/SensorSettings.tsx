// Pattern check: Dispatch Map (Tier 0) — applied — setting type → row renderer map (bool/int/enum) instead of a switch.
//
// The sensor's own settings in the inspector, drawn from what the sensor
// describes (catalog.sensor.settings): a BOOL as a switch, an INT as a slider
// (a number field when its range is too wide to slide), an ENUM as a
// segmented control (a select past three options). Advanced ones fold away.
// A setting the user set shows a reset; one left out shows the device's
// default.
import { useState, type JSX } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import type {
    SensorBinding,
    SensorSettingSpec,
    SensorSettingType,
    SensorSettingValue,
    SensorUnit,
} from '@firmware/devices/types'
import { RangeRow } from '@/components/RangeRow'
import { cn } from '@/lib/cn'
import { Input } from '@/ui/input'
import { Segmented } from '@/ui/segmented'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'
import { SwitchRow } from './parts'

const UNIT: Readonly<Record<SensorUnit, string>> = {
    '': '',
    ms: ' ms',
    us: ' µs',
    deg: '°',
    cpi: ' CPI',
    '%': '%',
}

/** Past this many steps a slider cannot hit a value: type it instead. */
const SLIDER_STEPS_MAX = 2000
/** Past this many options a segmented control does not fit the panel. */
const SEGMENTED_MAX = 3

interface RowProps {
    s: SensorSettingSpec
    value: SensorSettingValue
    disabled: boolean
    onChange: (v: SensorSettingValue) => void
}

function BoolRow({ s, value, disabled, onChange }: RowProps): JSX.Element {
    return (
        <SwitchRow
            label={s.label}
            hint={s.help}
            checked={value === true || value === 1}
            disabled={disabled}
            onChange={onChange}
        />
    )
}

/** A wide INT as a number field, committed on blur or Enter. */
function NumberRow({ s, value, disabled, onChange }: RowProps): JSX.Element {
    const [draft, setDraft] = useState<string | null>(null)
    const commit = (): void => {
        const n = Number(draft)
        if (draft !== null && draft.trim() !== '' && Number.isFinite(n))
            onChange(Math.round(n))
        setDraft(null)
    }
    return (
        <label className="flex items-center gap-2.5 py-[7px]">
            <span className="flex-1 text-[13px] font-semibold">{s.label}</span>
            <Input
                inputMode="numeric"
                aria-label={s.label}
                value={draft ?? String(value)}
                disabled={disabled}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') commit()
                }}
                className="h-8 w-28 text-right font-mono text-xs"
            />
            <span className="w-6 text-[11px] text-muted-foreground">
                {UNIT[s.unit].trim()}
            </span>
        </label>
    )
}

function IntRow(props: RowProps): JSX.Element {
    const { s, value, disabled, onChange } = props
    const min = s.min ?? 0
    const max = s.max ?? 100
    const step = s.step || 1
    if ((max - min) / step > SLIDER_STEPS_MAX) return <NumberRow {...props} />
    return (
        <RangeRow
            label={s.label}
            value={Number(value)}
            min={min}
            max={max}
            step={step}
            suffix={UNIT[s.unit]}
            disabled={disabled}
            onCommit={onChange}
        />
    )
}

function EnumRow({ s, value, disabled, onChange }: RowProps): JSX.Element {
    const options = (s.options ?? []).map((o) => ({
        value: String(o.value),
        label: o.label,
    }))
    const pick = (v: string): void => onChange(Number(v))
    return (
        <div
            className={cn(
                'flex items-center justify-between gap-2 py-[7px]',
                disabled && 'pointer-events-none opacity-60',
            )}
        >
            <span className="text-[13px] font-semibold">{s.label}</span>
            {options.length <= SEGMENTED_MAX ? (
                <Segmented
                    value={String(value)}
                    options={options}
                    onChange={pick}
                />
            ) : (
                <Select
                    value={String(value)}
                    disabled={disabled}
                    onValueChange={pick}
                >
                    <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
    )
}

const ROWS: Readonly<Record<SensorSettingType, (p: RowProps) => JSX.Element>> =
    {
        bool: BoolRow,
        int: IntRow,
        enum: EnumRow,
    }

/** One setting with its reset when the user set it. */
function SettingRow({
    s,
    settings,
    disabled,
    onChange,
}: {
    s: SensorSettingSpec
    settings: SensorBinding['settings']
    disabled: boolean
    onChange: (next: SensorBinding['settings']) => void
}): JSX.Element {
    const Row = ROWS[s.type]
    const set = s.name in settings
    const reset = (): void =>
        onChange(
            Object.fromEntries(
                Object.entries(settings).filter(([k]) => k !== s.name),
            ),
        )
    return (
        <div className="group relative">
            <Row
                s={s}
                value={settings[s.name] ?? s.default}
                disabled={disabled}
                onChange={(v) => onChange({ ...settings, [s.name]: v })}
            />
            {set && !disabled && (
                <button
                    type="button"
                    onClick={reset}
                    title={`Back to the default (${String(s.default)})`}
                    aria-label={`Reset ${s.label}`}
                    className="absolute -left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                >
                    <RotateCcw className="size-3" />
                </button>
            )}
        </div>
    )
}

/** Every setting the sensor describes, the advanced ones folded away. */
export function SensorSettings({
    specs,
    settings,
    disabled,
    onChange,
}: {
    specs: readonly SensorSettingSpec[]
    settings: SensorBinding['settings']
    disabled: boolean
    onChange: (next: SensorBinding['settings']) => void
}): JSX.Element {
    const [open, setOpen] = useState(false)
    const basic = specs.filter((s) => !s.advanced)
    const advanced = specs.filter((s) => s.advanced)
    const row = (s: SensorSettingSpec): JSX.Element => (
        <SettingRow
            key={s.name}
            s={s}
            settings={settings}
            disabled={disabled}
            onChange={onChange}
        />
    )
    return (
        <div>
            {basic.map(row)}
            {advanced.length > 0 && (
                <>
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        aria-expanded={open}
                        className="mt-1 flex items-center gap-1 py-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                        <ChevronRight
                            className={cn(
                                'size-3.5 transition-transform',
                                open && 'rotate-90',
                            )}
                        />
                        Advanced ({advanced.length})
                    </button>
                    {open && advanced.map(row)}
                </>
            )}
        </div>
    )
}
