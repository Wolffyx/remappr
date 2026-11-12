// Pattern check: no GoF pattern (-) — rejected — thin host of the shared DisplaysEditor over a mouse / joystick's staged document (DeviceConfigDraft), like DevicePowerPanel.
//
// A mouse's or joystick's displays in its Device settings: edits go into the
// same staged document as the rest of the device, so the header's Save
// writes them. Absent when the device has no display part or cannot stage a
// document.
import { JSX, useEffect, useState } from 'react'
import type { ConfigDevice } from '@firmware/config'
import type { DeviceConfigApi, ScreensApi } from '@firmware/service'
import { DisplaysEditor } from './DisplayEditor'
import { useDisplayParts } from './useDisplayParts'

export function DeviceDisplaysPanel({
    device,
    screens,
    deviceName,
}: {
    device: DeviceConfigApi
    screens: ScreensApi
    deviceName: string
}): JSX.Element | null {
    const parts = useDisplayParts(screens)
    const draft = device.draft
    const [doc, setDoc] = useState<ConfigDevice | null>(
        () => draft?.get() ?? null,
    )
    useEffect(() => draft?.onChanged(setDoc), [draft])
    if (!draft || !doc || !parts?.length) return null
    return (
        <DisplaysEditor
            screens={screens}
            parts={parts}
            displays={doc.displays ?? []}
            disabled={!device.writable}
            deviceName={deviceName}
            onChange={(displays) => {
                const next: ConfigDevice = { ...doc }
                delete next.displays
                draft.set(displays.length ? { ...next, displays } : next)
            }}
        />
    )
}
