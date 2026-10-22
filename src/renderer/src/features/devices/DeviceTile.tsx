// Pattern check: no GoF pattern (-) — rejected — presentational tile lifted out of DemoDeviceModal so the demo chooser and the start page's generic devices draw the same card.
import { useMemo, type JSX } from 'react'
import type {
    ControlsCatalog,
    DeviceBindings,
    DeviceModel,
} from '@firmware/devices/types'
import { indexCatalog } from '@/lib/devices/bindingSummary'
import { deviceSummary, FORM_LABEL } from '@/lib/devices/labels'
import { DeviceStage } from './stage/DeviceStage'
import { FORM_ICON } from './formIcons'

const BADGES = {
    ready: { text: 'READY', hue: 152 },
    defaulted: { text: 'NO LAYOUT', hue: 80 },
} as const

export interface DeviceTileProps {
    name: string
    model: DeviceModel
    bindings: DeviceBindings
    catalog: ControlsCatalog
    /** The line under the preview; absent = what the layout holds. */
    summary?: string
    onPick: () => void
}

function defaultSummary(model: DeviceModel): string {
    if (!model.defaulted) return deviceSummary(model.form, model.controls)
    return model.hidSummary ?? FORM_LABEL[model.form]
}

/** A device as a tile: name, READY / NO LAYOUT, a stage preview tinted by its
 *  bindings, and its form. */
export function DeviceTile({
    name,
    model,
    bindings,
    catalog,
    summary,
    onPick,
}: DeviceTileProps): JSX.Element {
    const index = useMemo(() => indexCatalog(catalog), [catalog])
    const badge = model.defaulted ? BADGES.defaulted : BADGES.ready
    const Icon = FORM_ICON[model.form]
    return (
        <button
            type="button"
            onClick={onPick}
            className="flex min-w-0 flex-col rounded-xl border border-border bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))] p-3 text-left text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_16px_36px_-14px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
        >
            <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-panel-title font-bold">
                    {name}
                </span>
                <span
                    className="shrink-0 rounded-full px-[7px] py-0.5 text-[9.5px] font-bold"
                    style={{
                        color: `oklch(0.76 0.15 ${badge.hue})`,
                        background: `color-mix(in oklab, oklch(0.72 0.16 ${badge.hue}) 16%, transparent)`,
                    }}
                >
                    {badge.text}
                </span>
            </div>
            <div
                className="relative -mx-1 my-1.5 h-[104px]"
                style={{
                    maskImage:
                        'radial-gradient(120% 120% at 50% 50%, #000 70%, transparent)',
                }}
            >
                <DeviceStage
                    model={model}
                    bindings={bindings}
                    index={index}
                    labels="clean"
                    preview
                    className="inset-0"
                />
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-[13px] shrink-0" />
                <span className="truncate">
                    {summary ?? defaultSummary(model)}
                </span>
            </div>
        </button>
    )
}
