// Pattern check: Dispatch Map (Tier 0) — applied — shell type → parameter-slider table; the panels themselves are presentational.
//
// The Builder's device-layout side panels: the selected control's geometry,
// shape, zone and callout, or — with nothing selected — the shell and the
// controls you can add.
import { useState, type JSX } from 'react'
import { Code, Plus, Trash2 } from 'lucide-react'
import { CONTROL_KINDS, CONTROL_SHAPES } from '@firmware/devices/schema'
import { SHELL_ZONES } from '@firmware/devices/stockLayouts'
import type {
    ControlKind,
    DeviceControl,
    DeviceModel,
    ShellType,
} from '@firmware/devices/types'
import { Button } from '@/ui/button'
import { Segmented } from '@/ui/segmented'
import { RangeRow } from '@/components/RangeRow'
import { cn } from '@/lib/cn'
import { KIND_LABEL } from '@/lib/devices/labels'
import { InSection, SwitchRow } from '../inspector/parts'
import { NumField } from './NumField'

type ControlPatch = Partial<Record<keyof DeviceControl, unknown>>

const SIZE_PRESETS: readonly [number, number][] = [
    [0.5, 0.5],
    [0.75, 0.75],
    [1, 1],
    [1.7, 1.7],
    [0.75, 0.4],
    [2.5, 0.75],
]

function Chips<T extends string>({
    options,
    value,
    onChange,
}: {
    options: readonly T[]
    value: T
    onChange: (v: T) => void
}): JSX.Element {
    return (
        <div className="flex flex-wrap gap-[5px]">
            {options.map((o) => (
                <button
                    key={o}
                    type="button"
                    onClick={() => onChange(o)}
                    className={cn(
                        'rounded-[7px] border px-2.5 py-1.5 text-xs font-semibold',
                        o === value
                            ? 'border-primary/60 bg-[color-mix(in_oklch,var(--primary)_18%,var(--secondary))]'
                            : 'border-border bg-secondary',
                    )}
                >
                    {o}
                </button>
            ))}
        </div>
    )
}

/** Name input that commits once on blur / Enter (one history step). */
function NameField({
    value,
    onChange,
}: {
    value: string
    onChange: (v: string) => void
}): JSX.Element {
    const [text, setText] = useState<string | null>(null)
    const apply = (raw: string): void => {
        setText(null)
        const v = raw.trim()
        if (v && v !== value) onChange(v)
    }
    return (
        <input
            aria-label="Control name"
            value={text ?? value}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => apply(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') apply(e.currentTarget.value)
            }}
            className="mt-[5px] block h-[34px] w-full rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none"
        />
    )
}

export function GeometryPanel({
    model,
    control: c,
    onPatch,
    onRemove,
}: {
    model: DeviceModel
    control: DeviceControl
    onPatch: (patch: ControlPatch) => void
    onRemove: () => void
}): JSX.Element {
    const zones = SHELL_ZONES[model.shell.type]
    return (
        <>
            <InSection
                label="Position (U)"
                right={
                    <span className="text-[11px] text-muted-foreground">
                        drag · ⌥ for free
                    </span>
                }
            >
                <div className="grid grid-cols-2 gap-2.5">
                    <NumField
                        label="X"
                        value={c.x}
                        onChange={(x) => onPatch({ x })}
                    />
                    <NumField
                        label="Y"
                        value={c.y}
                        onChange={(y) => onPatch({ y })}
                    />
                    <NumField
                        label="Width"
                        value={c.w}
                        onChange={(w) => onPatch({ w: Math.max(0.25, w) })}
                    />
                    <NumField
                        label="Height"
                        value={c.h}
                        onChange={(h) => onPatch({ h: Math.max(0.25, h) })}
                    />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-[5px]">
                    {SIZE_PRESETS.map(([w, h]) => (
                        <button
                            key={`${w}x${h}`}
                            type="button"
                            onClick={() => onPatch({ w, h })}
                            className={cn(
                                'rounded-md border border-border px-2 py-1 font-mono text-[11px] font-semibold',
                                c.w === w && c.h === h
                                    ? 'bg-[color-mix(in_oklch,var(--primary)_18%,var(--secondary))] text-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {w}×{h}
                        </button>
                    ))}
                </div>
            </InSection>
            <InSection label="Rotation">
                <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
                    <NumField
                        label="Angle"
                        unit="°"
                        step={5}
                        value={c.r ?? 0}
                        onChange={(r) => onPatch({ r: r || undefined })}
                    />
                    <Button
                        variant="secondary"
                        onClick={() => onPatch({ r: undefined })}
                    >
                        Reset
                    </Button>
                </div>
            </InSection>
            <InSection label="Shape">
                <Chips
                    options={CONTROL_SHAPES}
                    value={c.shape}
                    onChange={(shape) => onPatch({ shape })}
                />
            </InSection>
            <InSection label="Shell">
                <p className="mb-2 text-[11.5px] leading-normal text-muted-foreground">
                    Which part of the body this control sits on. The shell
                    refits around its zone.
                </p>
                <Chips
                    options={zones}
                    value={c.zone ?? zones[0]!}
                    onChange={(zone) =>
                        onPatch({ zone: zone === 'body' ? undefined : zone })
                    }
                />
                <SwitchRow
                    label="On the edge / back"
                    hint="Drawn outside the shell fit — side buttons, paddles"
                    checked={!!c.edge}
                    onChange={(edge) =>
                        onPatch({
                            edge: edge || undefined,
                            back:
                                edge && model.shell.type === 'gamepad'
                                    ? true
                                    : undefined,
                        })
                    }
                />
            </InSection>
            <InSection label="Callout">
                <div className="[&>div]:flex [&>div]:w-full [&_button]:flex-1">
                    <Segmented
                        value={c.label ?? 'auto'}
                        options={[
                            { value: 'auto', label: 'Auto side' },
                            { value: 'L', label: 'Left' },
                            { value: 'R', label: 'Right' },
                        ]}
                        onChange={(v) =>
                            onPatch({ label: v === 'auto' ? undefined : v })
                        }
                    />
                </div>
                <div className="mt-2.5">
                    <span className="text-[11.5px] font-semibold text-muted-foreground">
                        Name
                    </span>
                    <NameField
                        value={c.name}
                        onChange={(name) => onPatch({ name })}
                    />
                </div>
            </InSection>
            <div className="border-t border-border px-4 pt-3.5 pb-5">
                <Button
                    variant="secondary"
                    className="w-full text-destructive"
                    onClick={onRemove}
                >
                    <Trash2 className="size-3.5" /> Remove control
                </Button>
            </div>
        </>
    )
}

type ShellParam = readonly [
    key: string,
    label: string,
    min: number,
    max: number,
    step: number,
    unit: string,
]

const SHELL_PARAMS: Readonly<Record<ShellType, readonly ShellParam[]>> = {
    mouse: [
        ['pad', 'Edge padding', 0, 1, 0.05, 'U'],
        ['tail', 'Palm length', 0.5, 4, 0.1, 'U'],
    ],
    gamepad: [
        ['pad', 'Side padding', 0.3, 2, 0.05, 'U'],
        ['gripW', 'Grip width', 2, 5, 0.05, 'U'],
        ['gripAngle', 'Grip angle', 0, 30, 1, '°'],
    ],
    plate: [['pad', 'Plate margin', 0.1, 1, 0.05, 'U']],
    flightstick: [
        ['pad', 'Grip padding', 0.2, 1.2, 0.05, 'U'],
        ['basePad', 'Base padding', 0.3, 1.6, 0.05, 'U'],
        ['shaftW', 'Shaft width', 0.5, 1.6, 0.05, 'U'],
    ],
}

function footprint(model: DeviceModel): string {
    if (!model.controls.length) return '—'
    const xs = model.controls.flatMap((c) => [c.x, c.x + c.w])
    const ys = model.controls.flatMap((c) => [c.y, c.y + c.h])
    const w = Math.max(...xs) - Math.min(...xs)
    const h = Math.max(...ys) - Math.min(...ys)
    return `${w.toFixed(1)}×${h.toFixed(1)}U`
}

export function ShellPanel({
    model,
    canAdd,
    onShell,
    onAdd,
    onOpenJson,
}: {
    model: DeviceModel
    /** False when re-drawing a device: its inputs are fixed. */
    canAdd: boolean
    onShell: (patch: Record<string, number>) => void
    onAdd: (kind: ControlKind) => void
    onOpenJson: () => void
}): JSX.Element {
    const shell = model.shell as unknown as Record<string, number>
    return (
        <>
            <div className="p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    Controls are placed in key units, like keyboard keys. The{' '}
                    <b className="text-foreground">{model.shell.type}</b> shell
                    is generated from their positions — drag a control and the
                    body refits.
                </p>
                <div className="mt-3 flex gap-2">
                    {[
                        ['Controls', String(model.controls.length)],
                        ['Footprint', footprint(model)],
                    ].map(([k, v]) => (
                        <div
                            key={k}
                            className="flex-1 rounded-[9px] border border-border bg-secondary px-[11px] py-[9px]"
                        >
                            <div className="text-[10.5px] font-bold tracking-[.07em] text-muted-foreground uppercase">
                                {k}
                            </div>
                            <div className="mt-0.5 font-mono text-sm font-bold">
                                {v}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <InSection label="Shell parameters">
                {SHELL_PARAMS[model.shell.type].map(
                    ([key, label, min, max, step, unit]) => (
                        <RangeRow
                            key={key}
                            label={label}
                            value={shell[key] ?? 0}
                            min={min}
                            max={max}
                            step={step}
                            suffix={unit}
                            onCommit={(v) => onShell({ [key]: v })}
                        />
                    ),
                )}
            </InSection>
            {canAdd && (
                <InSection label="Add control">
                    <div className="grid grid-cols-2 gap-1.5">
                        {CONTROL_KINDS.map((k) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => onAdd(k)}
                                className="flex items-center gap-[7px] rounded-lg border border-dashed border-border bg-secondary px-2.5 py-2 text-left text-[12.5px] font-semibold hover:border-primary"
                            >
                                <Plus className="size-[13px] text-primary" />
                                {KIND_LABEL[k]}
                            </button>
                        ))}
                    </div>
                </InSection>
            )}
            <InSection label="Device layout">
                <Button
                    variant="secondary"
                    className="w-full"
                    onClick={onOpenJson}
                >
                    <Code className="size-3.5" /> View / edit layout JSON
                </Button>
            </InSection>
        </>
    )
}
