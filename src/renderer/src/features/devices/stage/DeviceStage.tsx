// Pattern check: no GoF pattern (-) — rejected — composition root of the device canvas (shell, controls, callouts, hover card); geometry and stacking live in pure modules.
//
// The device drawn from its model: the fitted body, every control tinted by
// what it is bound to, and either callout cards with leader lines ("Labels")
// or a hover card ("Clean"). Scales to fit its box.
import { useCallback, useMemo, useRef, useState, type JSX } from 'react'
import type {
    DeviceBindings,
    DeviceControl,
    DeviceModel,
} from '@firmware/devices/types'
import {
    bindingSummary,
    type BindingSummary,
    type CatalogIndex,
} from '@/lib/devices/bindingSummary'
import { categoryAccent } from '@/lib/devices/deviceCategory'
import { cn } from '@/lib/cn'
import { calloutAnchors, layoutCallouts } from './callouts'
import { Callout, CalloutDots, CalloutLines } from './Callouts'
import { ControlShape, type ControlBox } from './ControlShape'
import { computeLayout, DEV_S, hasCallout, type StageLayout } from './geometry'
import { ShellView } from './ShellView'
import { useBoxSize } from './useBoxSize'

export type StageLabels = 'callouts' | 'clean'

export interface DeviceStageProps {
    model: DeviceModel
    bindings: DeviceBindings
    index: CatalogIndex
    selected?: string | null
    onSelect?: (id: string | null) => void
    labels?: StageLabels
    mono?: boolean
    live?: boolean
    /** Start-page tile: no interaction, no gutters, may shrink a lot. */
    preview?: boolean
    className?: string
}

const NOOP = (): void => {}

function boxOf(c: DeviceControl, L: StageLayout): ControlBox {
    return {
        x: L.ox + c.x * DEV_S,
        y: L.oy + c.y * DEV_S,
        w: c.w * DEV_S,
        h: c.h * DEV_S,
    }
}

function HoverCard({
    control,
    box,
    summary,
}: {
    control: DeviceControl
    box: ControlBox
    summary: BindingSummary
}): JSX.Element {
    return (
        <div
            className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-full rounded-[9px] border border-border bg-popover px-[11px] py-[7px] whitespace-nowrap shadow-[0_10px_28px_rgba(0,0,0,.4)]"
            style={{ left: box.x + box.w / 2, top: box.y - 10 }}
        >
            <div className="text-[10px] font-bold tracking-[.07em] text-muted-foreground uppercase">
                {control.name}
            </div>
            <div className="flex items-center gap-1.5 text-[13px] font-bold">
                <span
                    className="size-[7px] rounded-[3px]"
                    style={{ background: categoryAccent(summary.cat) }}
                />
                {summary.text}
            </div>
        </div>
    )
}

export function DeviceStage({
    model,
    bindings,
    index,
    selected = null,
    onSelect,
    labels = 'callouts',
    mono = false,
    live = false,
    preview = false,
    className,
}: DeviceStageProps): JSX.Element {
    const wrapRef = useRef<HTMLDivElement>(null)
    const size = useBoxSize(wrapRef)
    const [hover, setHover] = useState<string | null>(null)
    const select = onSelect ?? NOOP
    const showCallouts = labels === 'callouts' && !preview

    const L = useMemo(
        () => computeLayout(model, { compact: preview }),
        [model, preview],
    )
    const summaries = useMemo(
        () =>
            new Map(
                model.controls.map((c) => [
                    c.id,
                    bindingSummary(c, bindings, index),
                ]),
            ),
        [model, bindings, index],
    )
    const anchors = useMemo(
        () => (showCallouts ? calloutAnchors(model, L) : []),
        [showCallouts, model, L],
    )
    const ys = useMemo(() => layoutCallouts(anchors, L.H), [anchors, L.H])
    const active = useCallback(
        (id: string) => id === selected || id === hover,
        [selected, hover],
    )
    const onHover = useCallback((id: string | null) => setHover(id), [])

    const scale = Math.max(
        preview ? 0.05 : 0.3,
        Math.min(size.w / L.W, size.h / L.H, 1.35) * 0.96,
    )
    const hovered =
        !showCallouts && !preview && hover
            ? model.controls.find((c) => c.id === hover)
            : undefined

    return (
        <div
            ref={wrapRef}
            onPointerDown={() => select(null)}
            className={cn(
                'absolute overflow-hidden',
                preview && 'pointer-events-none',
                className,
            )}
        >
            <div
                className="absolute top-1/2 left-1/2 transition-[width,height] duration-150"
                style={{
                    width: L.W,
                    height: L.H,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                }}
            >
                <div
                    key={model.name}
                    className="fade-in relative"
                    style={{ width: L.W, height: L.H }}
                >
                    <ShellView parts={L.shell} ox={L.ox} oy={L.oy} />
                    {showCallouts ? (
                        <CalloutLines
                            anchors={anchors}
                            ys={ys}
                            width={L.W}
                            height={L.H}
                            active={active}
                        />
                    ) : null}
                    {model.controls.map((c) => (
                        <ControlShape
                            key={c.id}
                            control={c}
                            box={boxOf(c, L)}
                            summary={summaries.get(c.id)!}
                            selected={selected === c.id}
                            hovered={hover === c.id}
                            mono={mono}
                            live={live}
                            preview={preview}
                            onSelect={select}
                            onHover={onHover}
                        />
                    ))}
                    {showCallouts ? (
                        <CalloutDots
                            anchors={anchors}
                            width={L.W}
                            height={L.H}
                            active={active}
                        />
                    ) : null}
                    {showCallouts
                        ? model.controls
                              .filter(hasCallout)
                              .map((c) => (
                                  <Callout
                                      key={c.id}
                                      control={c}
                                      side={L.side(c)}
                                      y={ys[c.id] ?? 0}
                                      summary={summaries.get(c.id)!}
                                      selected={selected === c.id}
                                      hovered={hover === c.id}
                                      mono={mono}
                                      onSelect={select}
                                      onHover={onHover}
                                  />
                              ))
                        : null}
                    {hovered ? (
                        <HoverCard
                            control={hovered}
                            box={boxOf(hovered, L)}
                            summary={summaries.get(hovered.id)!}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    )
}
