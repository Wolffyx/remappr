// Pattern check: Dispatch Map (Tier 0) — applied — control kind → section id → section view table; the sections shown come from lib/devices/sections.ts, gated on the adapter's fields.
//
// The per-kind settings of one control: what each button, wheel, stick,
// trigger, hat, sensor, encoder or axis can be set to. Only the sections the
// adapter honours are rendered; a read-only device shows them disabled.
import type { JSX } from 'react'
import type {
    AnalogValue,
    BindingByKind,
    ControlBinding,
    ControlKind,
    DeviceControl,
    DeviceForm,
    ResponseCurve,
    TriggerMode,
} from '@firmware/devices/types'
import { Segmented } from '@/ui/segmented'
import { RangeRow } from '@/components/RangeRow'
import { cn } from '@/lib/cn'
import type { CatalogIndex } from '@/lib/devices/bindingSummary'
import { CURVE_LABEL, TRIGGER_MODE_LABEL } from '@/lib/devices/labels'
import {
    supportsField,
    visibleSections,
    type SectionId,
} from '@/lib/devices/sections'
import { analogXY } from '../model/liveInputStore'
import { DpiStages } from './DpiStages'
import { HatGrid } from './HatGrid'
import { SensorSettings } from './SensorSettings'
import { ActionChip, InSection, LiveTag, OutSelect, SwitchRow } from './parts'
import { CurveGraph, DeadzoneViz, TriggerViz } from './viz'

export interface InspectorCtx<K extends ControlKind> {
    c: DeviceControl
    b: BindingByKind[K]
    ix: CatalogIndex
    form: DeviceForm
    editable: boolean
    live: boolean
    analog: AnalogValue | undefined
    set: (patch: Partial<Record<keyof BindingByKind[K], unknown>>) => void
    pick: (field: keyof BindingByKind[K] & string, title: string) => void
    can: (field: keyof BindingByKind[K]) => boolean
}

type View<K extends ControlKind> = (ctx: InspectorCtx<K>) => JSX.Element | null

const CURVES = (Object.keys(CURVE_LABEL) as ResponseCurve[]).map((value) => ({
    value,
    label: CURVE_LABEL[value],
}))
const TRIGGER_MODES = (Object.keys(TRIGGER_MODE_LABEL) as TriggerMode[]).map(
    (value) => ({ value, label: TRIGGER_MODE_LABEL[value] }),
)
const WAYS = [
    { value: '4', label: '4-way' },
    { value: '8', label: '8-way' },
]
const pollLabel = (hz: number): string =>
    hz >= 1000 ? `${hz / 1000}K` : String(hz)

/** One action slot of a section, hidden when the adapter does not honour it. */
function Slot<K extends ControlKind>({
    ctx,
    field,
    slot,
}: {
    ctx: InspectorCtx<K>
    field: keyof BindingByKind[K] & string
    slot: string
}): JSX.Element | null {
    if (!ctx.can(field)) return null
    return (
        <ActionChip
            slot={slot}
            value={ctx.b[field] as string | null}
            ix={ctx.ix}
            disabled={!ctx.editable}
            onClick={() =>
                ctx.pick(field, `${ctx.c.name} · ${slot.toLowerCase()}`)
            }
        />
    )
}

function CurveSeg({
    value,
    ctx,
}: {
    value: ResponseCurve
    ctx: InspectorCtx<'stick'> | InspectorCtx<'axis'>
}): JSX.Element {
    return (
        <div
            className={cn(
                'mb-2.5 [&>div]:flex [&>div]:w-full [&_button]:flex-1 [&_button]:px-1.5',
                !ctx.editable && 'pointer-events-none opacity-60',
            )}
        >
            <Segmented
                value={value}
                options={CURVES}
                onChange={(curve) => ctx.set({ curve })}
            />
        </div>
    )
}

const BUTTON: Partial<Record<SectionId, View<'button'>>> = {
    tap: (x) => (
        <InSection label="Tap">
            <ActionChip
                value={x.b.a}
                ix={x.ix}
                disabled={!x.editable}
                onClick={() => x.pick('a', `${x.c.name} · tap`)}
            />
        </InSection>
    ),
    hold: (x) => (
        <InSection
            label="Hold"
            right={
                !x.b.hold && x.editable ? (
                    <button
                        type="button"
                        onClick={() => x.pick('hold', `${x.c.name} · hold`)}
                        className="text-[11.5px] font-bold text-primary"
                    >
                        + Add hold action
                    </button>
                ) : null
            }
        >
            {x.b.hold ? (
                <ActionChip
                    value={x.b.hold}
                    ix={x.ix}
                    disabled={!x.editable}
                    onClick={() => x.pick('hold', `${x.c.name} · hold`)}
                    onClear={() => x.set({ hold: undefined })}
                />
            ) : (
                <p className="text-xs leading-normal text-muted-foreground">
                    Give this {x.form === 'mouse' ? 'button' : 'control'} a
                    second action when held past 200 ms — like Mod-Tap on your
                    keyboard.
                </p>
            )}
        </InSection>
    ),
    behaviour: (x) => (
        <InSection label="Behaviour">
            {x.can('turbo') && (
                <SwitchRow
                    label="Turbo"
                    hint="Repeat while held · 12 presses/s"
                    checked={!!x.b.turbo}
                    disabled={!x.editable}
                    onChange={(turbo) => x.set({ turbo })}
                />
            )}
            {x.can('toggle') && (
                <SwitchRow
                    label="Toggle"
                    hint="Press once to latch, again to release"
                    checked={!!x.b.toggle}
                    disabled={!x.editable}
                    onChange={(toggle) => x.set({ toggle })}
                />
            )}
        </InSection>
    ),
}

const WHEEL: Partial<Record<SectionId, View<'wheel'>>> = {
    directions: (x) => (
        <InSection label="Directions">
            <Slot ctx={x} field="up" slot="Scroll up" />
            <Slot ctx={x} field="down" slot="Scroll down" />
            <Slot ctx={x} field="click" slot="Click" />
            <Slot ctx={x} field="tl" slot="Tilt left" />
            <Slot ctx={x} field="tr" slot="Tilt right" />
        </InSection>
    ),
    feel: (x) => (
        <InSection label="Feel">
            {x.can('lines') && (
                <RangeRow
                    label="Lines per notch"
                    value={x.b.lines}
                    min={1}
                    max={10}
                    disabled={!x.editable}
                    onCommit={(lines) => x.set({ lines })}
                />
            )}
            {x.can('smooth') && (
                <SwitchRow
                    label="Smooth scrolling"
                    checked={x.b.smooth}
                    disabled={!x.editable}
                    onChange={(smooth) => x.set({ smooth })}
                />
            )}
            {x.can('freeSpin') && (
                <SwitchRow
                    label="Free-spin"
                    hint="Disengage the ratchet for long documents"
                    checked={x.b.freeSpin}
                    disabled={!x.editable}
                    onChange={(freeSpin) => x.set({ freeSpin })}
                />
            )}
        </InSection>
    ),
}

const STICK: Partial<Record<SectionId, View<'stick'>>> = {
    output: (x) => (
        <InSection label="Output">
            <OutSelect
                options={x.ix.catalog.outputs.stick ?? []}
                value={x.b.out}
                disabled={!x.editable}
                onChange={(out) => x.set({ out })}
            />
        </InSection>
    ),
    deadzone: (x) => (
        <InSection label="Deadzone" right={x.live ? <LiveTag /> : null}>
            <div className="flex items-center gap-3.5">
                <DeadzoneViz
                    inner={x.b.inner}
                    outer={x.b.outer}
                    round={x.b.round ?? true}
                    pos={x.live ? analogXY(x.analog) : undefined}
                />
                <div className="min-w-0 flex-1">
                    <RangeRow
                        label="Inner"
                        value={x.b.inner}
                        min={0}
                        max={40}
                        suffix="%"
                        disabled={!x.editable}
                        onCommit={(inner) => x.set({ inner })}
                    />
                    <RangeRow
                        label="Outer"
                        value={x.b.outer}
                        min={60}
                        max={100}
                        suffix="%"
                        disabled={!x.editable}
                        onCommit={(outer) => x.set({ outer })}
                    />
                </div>
            </div>
            {x.can('round') && (
                <SwitchRow
                    label="Round deadzone"
                    hint="Measure from the centre in every direction, not along each axis"
                    checked={x.b.round ?? true}
                    disabled={!x.editable}
                    onChange={(round) => x.set({ round })}
                />
            )}
        </InSection>
    ),
    curve: (x) => {
        const p = analogXY(x.analog)
        return (
            <InSection label="Response curve">
                <CurveSeg value={x.b.curve} ctx={x} />
                <CurveGraph
                    curve={x.b.curve}
                    dz={x.b.inner}
                    max={x.b.outer}
                    pos={x.live ? Math.min(1, Math.hypot(p.x, p.y)) : undefined}
                />
                {x.can('invY') && (
                    <SwitchRow
                        label="Invert Y axis"
                        checked={x.b.invY}
                        disabled={!x.editable}
                        onChange={(invY) => x.set({ invY })}
                    />
                )}
            </InSection>
        )
    },
    click: (x) =>
        x.c.glyph ? (
            <InSection label="Stick click">
                <ActionChip
                    value={x.b.click}
                    ix={x.ix}
                    disabled={!x.editable}
                    onClick={() => x.pick('click', `${x.c.name} · click`)}
                />
            </InSection>
        ) : null,
}

const TRIGGER: Partial<Record<SectionId, View<'trigger'>>> = {
    output: (x) => (
        <InSection label="Output">
            <OutSelect
                options={x.ix.catalog.outputs.trigger ?? []}
                value={x.b.out}
                disabled={!x.editable}
                onChange={(out) => x.set({ out })}
            />
        </InSection>
    ),
    travel: (x) => (
        <InSection label="Travel" right={x.live ? <LiveTag /> : null}>
            {x.can('mode') && (
                <div
                    className={cn(
                        'mb-2.5 [&>div]:flex [&>div]:w-full [&_button]:flex-1 [&_button]:px-1.5',
                        !x.editable && 'pointer-events-none opacity-60',
                    )}
                >
                    <Segmented
                        value={x.b.mode}
                        options={TRIGGER_MODES}
                        onChange={(mode) => x.set({ mode })}
                    />
                </div>
            )}
            <TriggerViz
                start={x.b.start}
                end={x.b.end}
                value={x.live && typeof x.analog === 'number' ? x.analog : 0}
            />
            <RangeRow
                label="Actuation start"
                value={x.b.start}
                min={0}
                max={50}
                suffix="%"
                disabled={!x.editable}
                onCommit={(start) => x.set({ start })}
            />
            <RangeRow
                label="Full press at"
                value={x.b.end}
                min={55}
                max={100}
                suffix="%"
                disabled={!x.editable}
                onCommit={(end) => x.set({ end })}
            />
            {x.can('rumble') && (
                <SwitchRow
                    label="Trigger rumble"
                    checked={x.b.rumble}
                    disabled={!x.editable}
                    onChange={(rumble) => x.set({ rumble })}
                />
            )}
        </InSection>
    ),
}

const HAT: Partial<Record<SectionId, View<'hat'>>> = {
    mode: (x) => (
        <InSection label="Mode">
            <div
                className={cn(
                    '[&>div]:flex [&>div]:w-full [&_button]:flex-1 [&_button]:px-1.5',
                    !x.editable && 'pointer-events-none opacity-60',
                )}
            >
                <Segmented
                    value={String(x.b.ways)}
                    options={WAYS}
                    onChange={(v) => x.set({ ways: Number(v) })}
                />
            </div>
        </InSection>
    ),
    directions: (x) => (
        <InSection label="Directions">
            <HatGrid
                b={x.b}
                ix={x.ix}
                disabled={!x.editable}
                onSlot={(dir, glyph) => x.pick(dir, `${x.c.name} · ${glyph}`)}
            />
        </InSection>
    ),
}

const SENSOR: Partial<Record<SectionId, View<'sensor'>>> = {
    stages: (x) => (
        <InSection
            label="DPI stages"
            right={
                <span className="text-[11px] text-muted-foreground">
                    DPI button cycles
                </span>
            }
        >
            <DpiStages
                b={x.b}
                spec={x.ix.catalog.sensor}
                disabled={!x.editable}
                onChange={(patch) => x.set(patch)}
            />
        </InSection>
    ),
    poll: (x) => {
        const rates = x.ix.catalog.sensor?.pollRates ?? [x.b.poll]
        return (
            <InSection label="Polling rate">
                <div
                    className={cn(
                        '[&>div]:flex [&>div]:w-full [&_button]:flex-1 [&_button]:px-1.5',
                        !x.editable && 'pointer-events-none opacity-60',
                    )}
                >
                    <Segmented
                        value={String(x.b.poll)}
                        options={rates.map((r) => ({
                            value: String(r),
                            label: pollLabel(r),
                        }))}
                        onChange={(v) => x.set({ poll: Number(v) })}
                    />
                </div>
            </InSection>
        )
    },
    tracking: (x) => {
        const specs = x.ix.catalog.sensor?.settings ?? []
        if (specs.length === 0) return null
        return (
            <InSection label="Sensor">
                <SensorSettings
                    specs={specs}
                    procedures={x.ix.catalog.sensor?.procedures ?? []}
                    index={x.ix.catalog.sensor?.index}
                    settings={x.b.settings ?? {}}
                    disabled={!x.editable}
                    onChange={(settings) => x.set({ settings })}
                />
            </InSection>
        )
    },
}

const ENCODER: Partial<Record<SectionId, View<'encoder'>>> = {
    rotation: (x) => (
        <InSection label="Rotation">
            <Slot ctx={x} field="cw" slot="Clockwise" />
            <Slot ctx={x} field="ccw" slot="Counter-CW" />
            <Slot ctx={x} field="press" slot="Press" />
        </InSection>
    ),
    feel: (x) => (
        <InSection label="Feel">
            <RangeRow
                label="Detents per action"
                value={x.b.sens}
                min={1}
                max={6}
                disabled={!x.editable}
                onCommit={(sens) => x.set({ sens })}
            />
        </InSection>
    ),
}

const AXIS: Partial<Record<SectionId, View<'axis'>>> = {
    output: (x) => (
        <InSection label="Output">
            <OutSelect
                options={x.ix.catalog.outputs.axis ?? []}
                value={x.b.out}
                disabled={!x.editable}
                onChange={(out) => x.set({ out })}
            />
        </InSection>
    ),
    response: (x) => (
        <InSection label="Response" right={x.live ? <LiveTag /> : null}>
            <CurveSeg value={x.b.curve} ctx={x} />
            <CurveGraph
                curve={x.b.curve}
                dz={x.b.dz}
                pos={x.live ? Math.abs(analogXY(x.analog).x) : undefined}
            />
            <RangeRow
                label="Center deadzone"
                value={x.b.dz}
                min={0}
                max={30}
                suffix="%"
                disabled={!x.editable}
                onCommit={(dz) => x.set({ dz })}
            />
            {x.can('inv') && (
                <SwitchRow
                    label="Invert axis"
                    checked={x.b.inv}
                    disabled={!x.editable}
                    onChange={(inv) => x.set({ inv })}
                />
            )}
        </InSection>
    ),
}

const VIEWS: { [K in ControlKind]: Partial<Record<SectionId, View<K>>> } = {
    button: BUTTON,
    wheel: WHEEL,
    stick: STICK,
    trigger: TRIGGER,
    hat: HAT,
    sensor: SENSOR,
    encoder: ENCODER,
    axis: AXIS,
}

export interface ControlInspectorProps {
    control: DeviceControl
    binding: ControlBinding
    index: CatalogIndex
    form: DeviceForm
    editable: boolean
    live: boolean
    analog: AnalogValue | undefined
    onPatch: (patch: Partial<Record<string, unknown>>) => void
    onPick: (field: string, title: string) => void
    /** Lay sections out in columns (workspace A's wide sheet). */
    wide?: boolean
}

export function ControlInspector(p: ControlInspectorProps): JSX.Element {
    const kind = p.control.kind
    const fields = p.index.catalog.fields
    const ctx: InspectorCtx<ControlKind> = {
        c: p.control,
        b: p.binding as BindingByKind[ControlKind],
        ix: p.index,
        form: p.form,
        editable: p.editable,
        live: p.live,
        analog: p.analog,
        set: p.onPatch,
        pick: p.onPick,
        can: (field) => supportsField(fields, kind, field as never),
    }
    const views = VIEWS[kind] as Partial<Record<SectionId, View<ControlKind>>>
    return (
        <div
            className={cn(
                p.wide &&
                    'grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] items-start',
            )}
        >
            {visibleSections(kind, fields).map((id) => {
                const View = views[id]
                return View ? <View key={id} {...ctx} /> : null
            })}
        </div>
    )
}
