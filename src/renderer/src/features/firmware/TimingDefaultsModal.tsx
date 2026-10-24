// Pattern check: no GoF pattern (-) — rejected — leaf settings view: reads staged
// defaults, renders per-field inputs, stages a patch; no abstraction to build.
//
// Config-blob timing / defaults editor (§7.4.1). Remappr-only: gated in the
// Header on `service.limits` and narrowed to the concrete RemapprKeyboardService
// (config-blob settings are not on the generic KeyboardService interface). Edits
// stage via setConfigDefaults() and push on commit(); fields the connected
// firmware does not advertise are annotated as ignored rather than hidden, so a
// config authored for newer firmware is still explicit about what won't apply.
import { FormGrid, FormRow } from '@/ui/form-row'
import { NumberInput } from '@/ui/number-input'
import { SectionLabel } from '@/ui/section-label'
import { useEffect, useRef, useState } from 'react'
import { Timer } from 'lucide-react'

import type { ConfigDefaults } from '@firmware/config'
import { supportsConfigEditing } from '@firmware/configEditing'

import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { LearnMore } from '@/ui/learn-more'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'

import {
    TIMING_FIELDS,
    type TimingFieldKey,
    fieldSupported,
    groupedTimingFields,
} from './timingFields'

interface Props {
    opened: boolean
    onClose: () => void
}

function zeroSeed(): Record<TimingFieldKey, number> {
    const seed = {} as Record<TimingFieldKey, number>
    for (const f of TIMING_FIELDS) seed[f.key] = 0
    return seed
}

export function TimingDefaultsModal({ opened, onClose }: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const configEditing = supportsConfigEditing(service) ? service : null
    const featureBitmask = service?.limits?.featureBitmask ?? 0

    const [values, setValues] =
        useState<Record<TimingFieldKey, number>>(zeroSeed)
    const initialRef = useRef<Record<TimingFieldKey, number>>(values)
    const [saving, setSaving] = useState(false)

    // Seed the editable fields from the device's committed + staged defaults each
    // time the modal opens (0 = firmware default).
    useEffect(() => {
        if (!opened || !configEditing) return
        const d = configEditing.getConfigDefaults()
        const seeded = zeroSeed()
        for (const f of TIMING_FIELDS) seeded[f.key] = d[f.key] ?? 0
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValues(seeded)
        initialRef.current = seeded
    }, [opened, configEditing])

    if (!configEditing) return <></>

    const handleSave = async (): Promise<void> => {
        if (!service) return
        const patch: Partial<ConfigDefaults> = {}
        for (const f of TIMING_FIELDS)
            if (values[f.key] !== initialRef.current[f.key])
                patch[f.key] = values[f.key]
        if (Object.keys(patch).length === 0) {
            onClose()
            return
        }
        setSaving(true)
        // Stage onto the concrete service, then push the whole config via commit.
        configEditing.setConfigDefaults(patch)
        const r = await saveWithToast(
            () => service.commit(),
            'Timing defaults saved',
            'Failed to save timing defaults',
        )
        setSaving(false)
        if (r !== undefined) onClose()
    }

    return (
        <Modal
            size="md"
            opened={opened}
            onClose={onClose}
            title="Timing and defaults"
            subtitle={
                <>
                    How long keys wait before acting, sent to the device.{' '}
                    <LearnMore path="guide/app/advanced#timing-defaults" />
                </>
            }
            headerIcon={<Timer />}
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
            <div className="flex flex-col gap-5 text-sm">
                {groupedTimingFields().map(([group, fields]) => (
                    <section key={group} className="flex flex-col gap-1">
                        <SectionLabel>{group}</SectionLabel>
                        <FormGrid>
                            {fields.map((f) => {
                                const supported = fieldSupported(
                                    f,
                                    featureBitmask,
                                )
                                return (
                                    <FormRow
                                        key={f.key}
                                        label={f.label}
                                        htmlFor={f.key}
                                        disabled={!supported}
                                        tone={supported ? undefined : 'warning'}
                                        hint={
                                            supported
                                                ? f.description
                                                : 'This firmware ignores this setting — update the firmware to use it.'
                                        }
                                    >
                                        <NumberInput
                                            id={f.key}
                                            unit="ms"
                                            min={f.min}
                                            max={f.max}
                                            value={values[f.key]}
                                            onChange={(e) =>
                                                setValues((v) => ({
                                                    ...v,
                                                    [f.key]:
                                                        parseInt(
                                                            e.target.value,
                                                            10,
                                                        ) || 0,
                                                }))
                                            }
                                            disabled={saving}
                                        />
                                    </FormRow>
                                )
                            })}
                        </FormGrid>
                    </section>
                ))}
            </div>
        </Modal>
    )
}
