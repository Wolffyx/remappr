// Pattern check: no GoF pattern (-) — rejected — leaf settings view: the shared DisplaysEditor over the keyboard's node.displays; stages one setNode() patch and pushes on commit() (mirrors PowerSettingsModal).
//
// What a keyboard's displays show and how (brightness, invert, rotation),
// in its config blob (node.displays: TBL_DISPLAY + the parts' TBL_PART
// settings). Mice and joysticks edit theirs in Device settings.
import { JSX, useEffect, useState } from 'react'
import { MonitorSmartphone } from 'lucide-react'
import type { ConfigDisplay } from '@firmware/config/types'
import { supportsConfigEditing } from '@firmware/configEditing'
import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { DisplaysEditor } from '@/features/display/DisplayEditor'
import { displayProblems } from '@/features/display/displayModel'
import { useDisplayParts } from '@/features/display/useDisplayParts'

interface Props {
    opened: boolean
    onClose: () => void
}

const same = (
    a: readonly ConfigDisplay[],
    b: readonly ConfigDisplay[],
): boolean => JSON.stringify(a) === JSON.stringify(b)

export function DisplaysModal({ opened, onClose }: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const configEditing = supportsConfigEditing(service) ? service : null
    const screens = service?.screens
    const parts = useDisplayParts(opened ? screens : undefined)
    const [displays, setDisplays] = useState<ConfigDisplay[]>([])
    const [orig, setOrig] = useState<ConfigDisplay[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!opened || !configEditing) return
        const d = configEditing.getNode().displays ?? []
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDisplays(d)
        setOrig(d)
    }, [opened, configEditing])

    if (!service || !configEditing || !screens) return <></>
    const readOnly = !!service.capabilities.readOnly
    const blocked = displayProblems(screens, displays).size > 0

    const handleSave = async (): Promise<void> => {
        if (same(displays, orig)) {
            onClose()
            return
        }
        // [] rather than undefined: setNode drops a key set to undefined (back
        // to the committed value); an empty list writes no TBL_DISPLAY.
        configEditing.setNode({ displays })
        setSaving(true)
        const saved = await saveWithToast(
            async () => {
                await service.commit()
                return true
            },
            'Displays saved',
            'Failed to save the displays',
        )
        setSaving(false)
        if (saved) onClose()
    }

    return (
        <Modal
            size="lg"
            opened={opened}
            onClose={onClose}
            title="Displays"
            subtitle={service.deviceInfo.name}
            headerIcon={<MonitorSmartphone />}
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
                        onClick={handleSave}
                        disabled={saving || readOnly || blocked}
                        title={
                            blocked ? 'Fix the marked widgets first' : undefined
                        }
                    >
                        Save
                    </Button>
                </>
            }
        >
            {parts === null && (
                <p className="p-2 text-sm text-muted-foreground">
                    Reading the device…
                </p>
            )}
            {parts?.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">
                    This device has no display.
                </p>
            )}
            {parts && parts.length > 0 && (
                <DisplaysEditor
                    screens={screens}
                    parts={parts}
                    displays={displays}
                    disabled={saving || readOnly}
                    deviceName={service.deviceInfo.name}
                    onChange={setDisplays}
                />
            )}
        </Modal>
    )
}
