// pattern-check: skip — presentational RGB controls; props in / callbacks out, no abstraction
//
// One RGB-lighting controls surface, shared by the demo simulation binding
// (SimulationPanel) and the connected-device binding (DeviceRgbControls). It only
// knows a normalized view model (effect list + index, 0–100 sliders, 0–360 hue) —
// never firmware bytes — so any source (sim store or device) drives the same UI.
//
// Laid out as three numbered steps (design review f15, option E1): 1 the effect,
// from a searchable grouped list with a moving preview per effect; 2 its colour,
// on a hue/saturation wheel with a name, hex and presets; 3 brightness and speed.
// A step the effect ignores stays visible, greyed, and says why.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'

import type { HsvColor } from '@firmware/service'
import { cn } from '@/lib/cn'
import { Input } from '@/ui/input'

import { colourName, lightCss, PRESETS, type HueSat } from './colourWheel'
import { groupEffects, plainName, previewOf } from './effectGroups'
import { hexToHsv, hsvToHex } from './hsv'
import { HueSatWheel } from './HueSatWheel'
import { RgbSlider } from './RgbSlider'
import { RgbToggle } from './RgbToggle'

export interface RgbControlsModel {
    /** Selectable effect names in display order. */
    effects: readonly string[]
    /** Index into `effects` of the active effect. */
    effectIndex: number
    brightness: number // 0..100
    saturation: number // 0..100
    speed: number // 0..100
    hue: number // 0..360
    /** Colour controls relevant for the current effect (hue/sat). */
    hasColor: boolean
    /** Animation speed adjustable. */
    hasSpeed: boolean
}

export interface RgbControlsToggles {
    underglow: boolean
    backlight: boolean
    perKey: boolean
    onToggle: (patch: Partial<Omit<RgbControlsToggles, 'onToggle'>>) => void
}

type Patch = Partial<
    Pick<RgbControlsModel, 'brightness' | 'saturation' | 'speed' | 'hue'>
>

interface Props {
    model: RgbControlsModel
    onEffect: (index: number) => void
    onChange: (patch: Patch) => void
    onReset: () => void
    /** Optional presentation toggles (demo mode). Omit for device mode. */
    toggles?: RgbControlsToggles
    note?: string
}

const MOTION = { none: '', move: 'rgb-swatch-move', pulse: 'rgb-swatch-pulse' }

function Swatch({
    name,
    hue,
    className,
}: {
    name: string
    hue: number
    className?: string
}): JSX.Element {
    const p = previewOf(name, hue)
    return (
        <span
            aria-hidden
            className={cn(
                'shrink-0 rounded-md shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_12%,transparent)]',
                MOTION[p.motion],
                className,
            )}
            style={{ background: p.background }}
        />
    )
}

function Step({
    n,
    title,
    summary,
    muted = false,
    children,
}: {
    n: number
    title: string
    summary?: string
    muted?: boolean
    children: ReactNode
}): JSX.Element {
    return (
        <section className="flex min-w-0 flex-col gap-3">
            <h3 className="flex items-center gap-2.5 text-panel-title font-bold">
                <span
                    className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full text-caption font-bold',
                        muted
                            ? 'bg-primary/15 text-primary'
                            : 'bg-primary text-primary-foreground',
                    )}
                >
                    {n}
                </span>
                {title}
                {summary && (
                    <span className="ml-auto truncate text-caption font-medium text-muted-foreground">
                        {summary}
                    </span>
                )}
            </h3>
            {children}
        </section>
    )
}

function EffectStep({
    model,
    onEffect,
}: {
    model: RgbControlsModel
    onEffect: (index: number) => void
}): JSX.Element {
    const [query, setQuery] = useState('')
    const groups = useMemo(
        () => groupEffects(model.effects, query),
        [model.effects, query],
    )
    const current = model.effects[model.effectIndex] ?? ''
    if (!model.effects.length)
        return (
            <Step n={1} title="Effect">
                <p className="text-control text-muted-foreground">
                    This light has no effects, only brightness.
                </p>
            </Step>
        )
    return (
        <Step n={1} title="Effect" summary={plainName(current)}>
            <div className="relative">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                    placeholder={`Search ${model.effects.length} effects`}
                    aria-label="Search effects"
                    className="h-8 pl-8"
                />
            </div>
            <div className="-mx-1 max-h-72 overflow-y-auto px-1">
                {groups.map(({ group, items }) => (
                    <div key={group} className="pb-1">
                        <p className="flex items-center px-2 pt-2 pb-1 text-caption font-semibold text-muted-foreground">
                            {group}
                            <span className="ml-auto font-mono">
                                {items.length}
                            </span>
                        </p>
                        {items.map((e) => {
                            const on = e.index === model.effectIndex
                            return (
                                <button
                                    key={e.index}
                                    type="button"
                                    title={e.name}
                                    aria-pressed={on}
                                    onClick={() => onEffect(e.index)}
                                    className={cn(
                                        'flex h-9 w-full items-center gap-2.5 rounded-md border border-transparent px-2 text-left text-control transition-colors hover:bg-accent hover:text-accent-foreground',
                                        on &&
                                            'border-primary/40 bg-primary/12 font-semibold',
                                    )}
                                >
                                    <Swatch
                                        name={e.name}
                                        hue={model.hue}
                                        className="h-5 w-10"
                                    />
                                    <span className="truncate">{e.label}</span>
                                </button>
                            )
                        })}
                    </div>
                ))}
                {!groups.length && (
                    <p className="px-2 py-3 text-control text-muted-foreground">
                        No effect matches “{query}”.
                    </p>
                )}
            </div>
        </Step>
    )
}

const toWire = ({ hue, saturation }: HueSat): HsvColor => ({
    h: Math.round((hue / 360) * 255),
    s: Math.round(saturation * 2.55),
    v: 255,
})

function HexField({
    value,
    onChange,
    disabled,
}: {
    value: HueSat
    onChange: (next: HueSat) => void
    disabled: boolean
}): JSX.Element {
    const hex = hsvToHex(toWire(value))
    const [draft, setDraft] = useState(hex)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setDraft(hex), [hex])
    const commit = (): void => {
        const hsv = hexToHsv(draft)
        if (!hsv) return setDraft(hex)
        onChange({
            hue: Math.round((hsv.h / 255) * 360),
            saturation: Math.round(hsv.s / 2.55),
        })
    }
    return (
        <Input
            value={draft}
            disabled={disabled}
            spellCheck={false}
            aria-label="Hex colour"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="h-8 w-24 font-mono uppercase"
        />
    )
}

function ColourStep({
    model,
    onChange,
}: {
    model: RgbControlsModel
    onChange: (patch: Patch) => void
}): JSX.Element {
    const value: HueSat = { hue: model.hue, saturation: model.saturation }
    const off = !model.hasColor
    const effect = plainName(model.effects[model.effectIndex] ?? '')
    const set = (c: HueSat): void =>
        onChange({ hue: c.hue, saturation: c.saturation })
    return (
        <Step
            n={2}
            title="Colour"
            muted={off}
            summary={off ? 'not used' : colourName(value)}
        >
            <div className="flex flex-wrap items-start gap-4">
                <HueSatWheel value={value} onChange={set} disabled={off} />
                <div
                    className={cn(
                        'flex min-w-48 flex-1 flex-col gap-3',
                        off && 'opacity-40',
                    )}
                >
                    <div className="flex items-center gap-2.5">
                        <span
                            aria-hidden
                            className="size-10 shrink-0 rounded-lg shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_15%,transparent)]"
                            style={{ background: lightCss(value) }}
                        />
                        <span className="min-w-0">
                            <span className="block font-semibold">
                                {colourName(value)}
                            </span>
                            <span className="block text-caption text-muted-foreground">
                                Hue {value.hue}° · saturation {value.saturation}
                                %
                            </span>
                        </span>
                    </div>
                    <HexField value={value} onChange={set} disabled={off} />
                    <div className="flex flex-wrap gap-1.5">
                        {PRESETS.map((p) => {
                            const on = colourName(value) === p.name && !off
                            return (
                                <button
                                    key={p.name}
                                    type="button"
                                    disabled={off}
                                    title={p.name}
                                    aria-label={p.name}
                                    aria-pressed={on}
                                    onClick={() => set(p)}
                                    className={cn(
                                        'size-6 rounded-md shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_15%,transparent)]',
                                        on &&
                                            'ring-2 ring-primary ring-offset-2 ring-offset-background',
                                    )}
                                    style={{ background: lightCss(p) }}
                                />
                            )
                        })}
                    </div>
                </div>
            </div>
            <p className="text-caption text-muted-foreground">
                {off
                    ? `${effect} makes its own colours, so there is nothing to pick here.`
                    : 'Round the wheel: colour. Towards the middle: paler.'}
            </p>
        </Step>
    )
}

function LevelStep({
    model,
    onChange,
    onReset,
    toggles,
}: {
    model: RgbControlsModel
    onChange: (patch: Patch) => void
    onReset: () => void
    toggles?: RgbControlsToggles
}): JSX.Element {
    const name = model.effects[model.effectIndex] ?? ''
    const p = previewOf(name, model.hue)
    return (
        <Step n={3} title="Brightness & speed">
            <span
                aria-hidden
                className={cn(
                    'h-4 rounded-md shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_12%,transparent)]',
                    MOTION[p.motion],
                )}
                style={{
                    background: model.hasColor
                        ? lightCss({
                              hue: model.hue,
                              saturation: model.saturation,
                          })
                        : p.background,
                    opacity: 0.25 + (0.75 * model.brightness) / 100,
                }}
            />
            <RgbSlider
                label="Brightness"
                value={model.brightness}
                onChange={(v) => onChange({ brightness: v })}
            />
            {model.hasSpeed ? (
                <RgbSlider
                    label="Speed"
                    value={model.speed}
                    onChange={(v) => onChange({ speed: v })}
                />
            ) : (
                <p className="text-caption text-muted-foreground">
                    Speed has no effect on{' '}
                    {plainName(name).toLowerCase() || 'this light'}.
                </p>
            )}
            {toggles && (
                <div className="flex flex-col gap-1.5">
                    <RgbToggle
                        on={toggles.underglow}
                        onToggle={(v) => toggles.onToggle({ underglow: v })}
                        label="RGB underglow"
                    />
                    <RgbToggle
                        on={toggles.backlight}
                        onToggle={(v) => toggles.onToggle({ backlight: v })}
                        label="Per-key backlight"
                    />
                    <RgbToggle
                        on={toggles.perKey}
                        onToggle={(v) => toggles.onToggle({ perKey: v })}
                        label="Per-key colour"
                    />
                </div>
            )}
            <button
                type="button"
                onClick={onReset}
                className="mt-auto mr-auto text-xs text-muted-foreground hover:text-foreground"
            >
                Reset to defaults
            </button>
        </Step>
    )
}

export function RgbControls({
    model,
    onEffect,
    onChange,
    onReset,
    toggles,
    note,
}: Props): JSX.Element {
    return (
        <div className="flex flex-col gap-3 text-sm">
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
                <EffectStep model={model} onEffect={onEffect} />
                <ColourStep model={model} onChange={onChange} />
                <LevelStep
                    model={model}
                    onChange={onChange}
                    onReset={onReset}
                    toggles={toggles}
                />
            </div>
        </div>
    )
}
