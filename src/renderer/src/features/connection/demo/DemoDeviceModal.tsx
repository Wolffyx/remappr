// Pattern check: no GoF pattern (-) — rejected — presentational chooser: a tile per demo device with a stage preview and a ready / no-layout badge.
import { useMemo, type JSX } from 'react'
import { Sparkles } from 'lucide-react'
import {
    DEMO_DEVICES,
    demoDevicePreview,
    type DemoDevice,
    type DemoDeviceId,
} from '@firmware'
import { Modal } from '@/ui/modal'
import { indexCatalog } from '@/lib/devices/bindingSummary'
import { deviceSummary, FORM_LABEL } from '@/lib/devices/labels'
import { DeviceStage } from '@/features/devices/stage/DeviceStage'
import { FORM_ICON } from '@/features/devices/formIcons'

const BADGES = {
    ready: { text: 'READY', hue: 152 },
    defaulted: { text: 'NO LAYOUT', hue: 80 },
} as const

function DemoTile({
    device,
    onPick,
}: {
    device: DemoDevice
    onPick: (id: DemoDeviceId) => void
}): JSX.Element {
    const preview = useMemo(() => demoDevicePreview(device.id), [device.id])
    const index = useMemo(() => indexCatalog(preview.catalog), [preview])
    const badge = device.ready ? BADGES.ready : BADGES.defaulted
    const Icon = FORM_ICON[device.form]
    const summary = device.ready
        ? deviceSummary(device.form, preview.model.controls)
        : (preview.model.hidSummary ?? FORM_LABEL[device.form])
    return (
        <button
            type="button"
            onClick={() => onPick(device.id)}
            className="flex min-w-0 flex-col rounded-[14px] border border-border bg-[color-mix(in_oklch,var(--primary)_5%,var(--card))] p-3 text-left text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_16px_36px_-14px_color-mix(in_oklch,var(--primary)_60%,transparent)]"
        >
            <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">
                    {device.name}
                </span>
                <span
                    className="shrink-0 rounded-full px-[7px] py-0.5 text-[9.5px] font-bold"
                    style={{
                        color: `oklch(0.76 0.15 ${badge.hue})`,
                        background: `color-mix(in oklch, oklch(0.72 0.16 ${badge.hue}) 16%, transparent)`,
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
                    model={preview.model}
                    bindings={preview.bindings}
                    index={index}
                    labels="clean"
                    preview
                    className="inset-0"
                />
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Icon className="size-[13px] shrink-0" />
                <span className="truncate">{summary}</span>
            </div>
        </button>
    )
}

/** Try Demo's chooser: every demo device, keyboards to controllers. */
export function DemoDeviceModal({
    opened,
    onClose,
    onPick,
}: {
    opened: boolean
    onClose: () => void
    onPick: (id: DemoDeviceId) => void
}): JSX.Element {
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Try a demo device"
            subtitle="Simulated devices — nothing is written anywhere"
            headerIcon={<Sparkles />}
            customModalBoxClass="w-11/12 max-w-3xl"
            showFooter={false}
            isDismissable
        >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-2.5">
                {DEMO_DEVICES.map((d) => (
                    <DemoTile
                        key={d.id}
                        device={d}
                        onPick={(id) => {
                            onClose()
                            onPick(id)
                        }}
                    />
                ))}
            </div>
            <p className="mt-3.5 text-center text-xs text-muted-foreground">
                {DEMO_DEVICES.length} demo devices · pick one to open its editor
            </p>
        </Modal>
    )
}
