// Pattern check: Dispatch Map (Tier 0) — applied — device kind → settings panel table; a kind with settings beyond its controls adds one entry.
//
// Settings a device has besides what its controls show on the stage (a
// mouse's pointer flags, curve and radio; a joystick's calibration), opened
// from the device editor's toolbar.
import { useState, type JSX } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { DeviceKind } from '@firmware/devices/types'
import type { KeyboardService } from '@firmware/service'
import { Modal } from '@/ui/modal'
import { ToolbarButton } from '@/layout/toolbar/ToolbarButton'
import useConnectionStore from '@/stores/connectionStore'
import { MouseSettingsPanel } from '@/features/device/MouseSettingsPanel'
import { JoystickSettingsPanel } from '@/features/device/JoystickSettingsPanel'

type Panel = (service: KeyboardService) => JSX.Element | null

const PANELS: Partial<Record<DeviceKind, Panel>> = {
    mouse: (s) =>
        s.device ? (
            <MouseSettingsPanel device={s.device} motion={s.motion} />
        ) : null,
    joystick: (s) =>
        s.joystick ? <JoystickSettingsPanel joystick={s.joystick} /> : null,
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
                opened={open}
                onClose={() => setOpen(false)}
                title="Device settings"
                subtitle={service?.deviceInfo.name}
                headerIcon={<SlidersHorizontal />}
                customModalBoxClass="w-11/12 max-w-2xl"
                showFooter={false}
                isDismissable
            >
                {open ? render() : null}
            </Modal>
        </>
    )
}
