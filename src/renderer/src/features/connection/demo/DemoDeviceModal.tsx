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
import { DeviceTile } from '@/features/devices/DeviceTile'

function DemoTile({
    device,
    onPick,
}: {
    device: DemoDevice
    onPick: (id: DemoDeviceId) => void
}): JSX.Element {
    const preview = useMemo(() => demoDevicePreview(device.id), [device.id])
    return (
        <DeviceTile
            name={device.name}
            model={preview.model}
            bindings={preview.bindings}
            catalog={preview.catalog}
            onPick={() => onPick(device.id)}
        />
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
