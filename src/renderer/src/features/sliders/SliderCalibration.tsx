// Pattern check: no GoF pattern (-) — rejected — finds the slot's SLIDER part and renders the shared PartPanel; presentational, one caller.
//
// A slider's own hardware, below its binding: its live readings and the
// calibration it offers (the travel's ends, then how much it jitters at rest),
// as the device describes its SLIDER parts. A slot drives the part of the same
// rank among them. A run takes effect at once and stays on the device, so no
// Save is involved.
import { JSX, useEffect, useState } from 'react'
import type { SensorInfo } from '@firmware/devices/types'
import type { SensorApi } from '@firmware/service'

import { PartPanel } from '@/features/device/SensorPanel'
import { SettingsSection } from '@/features/device/SettingRows'
import { sliderPartOf } from './model'

export function SliderCalibration({
    sensor,
    slot,
}: {
    sensor: SensorApi
    slot: number
}): JSX.Element | null {
    const [part, setPart] = useState<SensorInfo | null>(null)

    useEffect(() => {
        let live = true
        sensor
            .getSensors()
            .then((list) => live && setPart(sliderPartOf(list, slot)))
            .catch(() => live && setPart(null))
        return () => {
            live = false
        }
    }, [sensor, slot])

    if (!part) return null
    return (
        <SettingsSection
            title="Calibration"
            description="Kept on the slider, not in the saved settings. Calibrate measures how far it travels and how much it jitters at rest, so it reaches both ends and holds still."
        >
            <div className="flex flex-col gap-3">
                <PartPanel api={sensor} info={part} />
            </div>
        </SettingsSection>
    )
}
