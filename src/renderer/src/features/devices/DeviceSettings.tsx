// Pattern check: Dispatch Map (Tier 0) — applied — device kind → settings panel table; a kind with settings beyond its controls adds one entry.
//
// Settings a device has besides what its controls show on the stage (a
// mouse's pointer flags, curve, radio, power and sensor procedures; a
// joystick's calibration and power), opened from the device editor's toolbar.
import { useState, type JSX } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { DeviceKind } from '@firmware/devices/types'
import type { KeyboardService } from '@firmware/service'
import { Modal } from '@/ui/modal'
import { ToolbarButton } from '@/layout/toolbar/ToolbarButton'
import useConnectionStore from '@/stores/connectionStore'
import { MouseSettingsPanel } from '@/features/device/MouseSettingsPanel'
import { JoystickSettingsPanel } from '@/features/device/JoystickSettingsPanel'
import { SensorPanel } from '@/features/device/SensorPanel'
import { DevicePowerPanel } from '@/features/device/PowerSection'

type Panel = (service: KeyboardService) => JSX.Element | null

const PANELS: Partial<Record<DeviceKind, Panel>> = {
    mouse: (s) => {
        if (s.device) {
            return (
                <MouseSettingsPanel
                    device={s.device}
                    motion={s.motion}
                    sensor={s.sensor}
                />
            )
        }
        // A mouse with no settings document (the demo) still has its sensor.
        return s.sensor ? <SensorPanel sensor={s.sensor} /> : null
    },
    joystick: (s) =>
        s.joystick ? (
            <div className="flex flex-col gap-4">
                <JoystickSettingsPanel joystick={s.joystick} />
                {s.device && <DevicePowerPanel device={s.device} />}
            </div>
        ) : null,
}

/** The connected device's settings panel, or null when it has none. */
function panelFor(
    service: KeyboardService | null,
): (() => JSX.Element | null) | null {
    const panel = service?.kind ? PANELS[service.kind] : undefined
    if (!service || !panel || !panel(service)) return null
    return () => panel(service)
}

/** Toolbar button + dialog for the device's own settings. */
export function DeviceSettingsButton(): JSX.Element | null {
    const service = useConnectionStore((s) => s.service)
    const [open, setOpen] = useState(false)
    const render = panelFor(service)
    if (!render) return null
    return (
        <>
            <ToolbarButton
                icon={SlidersHorizontal}
                tooltip="Device settings"
                label="Device settings"
                active={open}
                onClick={() => setOpen(true)}
            />
            <Modal
                size="md"
                kind="live"
                opened={open}
                onClose={() => setOpen(false)}
                title="Device settings"
                subtitle={service?.deviceInfo.name}
                headerIcon={<SlidersHorizontal />}
                isDismissable
            >
                {open ? render() : null}
            </Modal>
        </>
    )
}
