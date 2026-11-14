// Pattern check: no GoF pattern (-) — rejected — leaf settings dialog over
// service.sensor, reusing the inspector's SensorSettings rows; no new
// abstraction.
//
// A keyboard's key-matrix settings (scan period, debounce, sleep scan, eager
// press): whatever its matrix part describes over the PART namespace, drawn
// generically, so a setting the firmware adds shows up without app changes.
// Save sets each changed value on the device at once (PART SET_SETTING).
import { useCallback, useEffect, useState } from 'react'
import { Grid3x3 } from 'lucide-react'
import type { SensorInfo } from '@firmware/devices/types'

import useConnectionStore from '@/stores/connectionStore'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { SensorSettings } from '@/features/devices/inspector/SensorSettings'
import { saveWithToast } from '@/lib/saveWithToast'

import {
    changedSettings,
    matrixParts,
    settingsInForce,
    type PartValues,
} from './scanningSettings'

interface Props {
    opened: boolean
    onClose: () => void
}

const errText = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

export function ScanningSettingsModal({ opened, onClose }: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const sensor = service?.sensor
    const [parts, setParts] = useState<readonly SensorInfo[] | null>(null)
    const [values, setValues] = useState<PartValues>({})
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async (): Promise<void> => {
        if (!sensor) return
        try {
            const found = matrixParts(await sensor.getSensors())
            setParts(found)
            setValues(settingsInForce(found))
            setError(null)
        } catch (e) {
            console.warn('Failed to read the key matrix settings', e)
            setParts([])
            setError(errText(e))
        }
    }, [sensor])

    useEffect(() => {
        if (!opened) return
        // Read on open; setState lands after the await.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load()
    }, [opened, load])

    if (!service || !sensor) return <></>
    const editable = sensor.writable && !saving

    const handleSave = async (): Promise<void> => {
        const changes = changedSettings(parts ?? [], values)
        if (changes.length === 0) {
            onClose()
            return
        }
        setSaving(true)
        const saved = await saveWithToast(
            async () => {
                for (const c of changes) {
                    await sensor.setSetting(c.part, c.name, c.value)
                }
                return true
            },
            'Scanning settings applied',
            'Failed to apply scanning settings',
        )
        setSaving(false)
        if (saved) {
            onClose()
            return
        }
        // Some changes may have landed before the one that failed: show what
        // the device holds now.
        void load()
    }

    return (
        <Modal
            size="md"
            opened={opened}
            onClose={onClose}
            title="Scanning"
            subtitle={service.deviceInfo.name}
            headerIcon={<Grid3x3 />}
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleSave()}
                        disabled={!editable || !parts?.length}
                    >
                        Apply
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4 p-2">
                <p className="text-xs text-muted-foreground">
                    How the keyboard reads its keys. Changes take effect at once
                    and last until the keyboard restarts or its config is saved
                    again.
                </p>
                {error && <p className="text-xs text-destructive">{error}</p>}
                {parts === null && !error && (
                    <p className="text-sm text-muted-foreground">Reading…</p>
                )}
                {parts?.length === 0 && !error && (
                    <p className="text-sm text-muted-foreground">
                        This keyboard describes no key-matrix settings.
                    </p>
                )}
                {parts?.map((p) => (
                    <SensorSettings
                        key={p.index}
                        // The dialog is the advanced view: show every row.
                        specs={p.settings.map((s) => ({
                            ...s,
                            advanced: false,
                        }))}
                        procedures={p.procedures}
                        index={p.index}
                        settings={values[p.index] ?? {}}
                        disabled={!editable}
                        onChange={(next) =>
                            setValues((v) => ({ ...v, [p.index]: next ?? {} }))
                        }
                    />
                ))}
            </div>
        </Modal>
    )
}
