// Pattern check: no GoF pattern (-) — rejected — leaf settings view: the mouse's
// PowerSection over the keyboard's node.power; stages one setNode() patch and
// pushes on commit() (mirrors TimingDefaultsModal).
//
// When a battery keyboard dims, sleeps and powers off (`node.power`, TBL_POWER
// in its config blob). The same section the mouse and joystick show; offered
// only where the keyboard reports a battery, and "Power off after" only where
// it can wake from power off (hw caps).
import { useEffect, useState } from 'react'
import { BatteryMedium } from 'lucide-react'

import type { ConfigPowerSettings } from '@firmware/config'
import { supportsConfigEditing } from '@firmware/configEditing'

import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { PowerSection } from '@/features/device/PowerSection'

interface Props {
    opened: boolean
    onClose: () => void
}

const same = (a?: ConfigPowerSettings, b?: ConfigPowerSettings): boolean =>
    JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})

export function PowerSettingsModal({ opened, onClose }: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const configEditing = supportsConfigEditing(service) ? service : null
    const [power, setPower] = useState<ConfigPowerSettings | undefined>()
    const [orig, setOrig] = useState<ConfigPowerSettings | undefined>()
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!opened || !configEditing) return
        const p = configEditing.getNode().power
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPower(p)
        setOrig(p)
    }, [opened, configEditing])

    if (!service || !configEditing) return <></>

    const handleSave = async (): Promise<void> => {
        if (same(power, orig)) {
            onClose()
            return
        }
        // {} rather than undefined: setNode drops a key set to undefined (back
        // to the committed value), and an empty section writes no TBL_POWER.
        configEditing.setNode({ power: power ?? {} })
        setSaving(true)
        const r = await saveWithToast(
            () => service.commit(),
            'Power settings saved',
            'Failed to save power settings',
        )
        setSaving(false)
        if (r !== undefined) onClose()
    }

    return (
        <Modal
            size="md"
            opened={opened}
            onClose={onClose}
            title="Power"
            subtitle={service.deviceInfo.name}
            headerIcon={<BatteryMedium />}
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        Save
                    </Button>
                </>
            }
        >
            <div className="p-2">
                <PowerSection
                    value={power}
                    onChange={setPower}
                    disabled={saving}
                    powerOff={!!service.capabilities.power?.powerOff}
                />
            </div>
        </Modal>
    )
}
