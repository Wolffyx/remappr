// Pattern check: no GoF pattern (-) — rejected — leaf settings view: reads staged
// defaults, renders per-field inputs, stages a patch; no abstraction to build.
//
// Config-blob timing / defaults editor (§7.4.1). Remappr-only: gated in the
// Header on `service.limits` and narrowed to the concrete RemapprKeyboardService
// (config-blob settings are not on the generic KeyboardService interface). Edits
// stage via setConfigDefaults() and push on commit(); fields the connected
// firmware does not advertise are annotated as ignored rather than hidden, so a
// config authored for newer firmware is still explicit about what won't apply.
// A field one of the device's parts holds as its own setting (a key matrix's
// scan period and debounce) is shown under that part, as the part describes
// it, its advanced settings folded away.
import { FormGrid, FormRow } from '@/ui/form-row'
import { NumberInput } from '@/ui/number-input'
import { SectionLabel } from '@/ui/section-label'
import { type JSX, useEffect, useRef, useState } from 'react'
import { ChevronRight, Timer } from 'lucide-react'

import type { ConfigDefaults } from '@firmware/config'
import { supportsConfigEditing } from '@firmware/configEditing'

import { cn } from '@/lib/cn'
import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { LearnMore } from '@/ui/learn-more'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'

import {
    TIMING_FIELDS,
    type TimingFieldDef,
    type TimingFieldKey,
    fieldSupported,
    groupedTimingFields,
    partTimingFields,
    timingFieldsFor,
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

/** One group of fields; its advanced ones behind a fold. */
function TimingSection({
    group,
    fields,
    row,
}: {
    group: string
    fields: readonly TimingFieldDef[]
    row: (f: TimingFieldDef) => JSX.Element
}): JSX.Element {
    const [open, setOpen] = useState(false)
    const basic = fields.filter((f) => !f.advanced)
    const advanced = fields.filter((f) => f.advanced)
    return (
        <section className="flex flex-col gap-1">
            <SectionLabel>{group}</SectionLabel>
            {basic.length > 0 && <FormGrid>{basic.map(row)}</FormGrid>}
            {advanced.length > 0 && (
                <>
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        aria-expanded={open}
                        className="flex items-center gap-1 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                        <ChevronRight
                            className={cn(
                                'size-3.5 transition-transform',
                                open && 'rotate-90',
                            )}
                        />
                        Advanced ({advanced.length})
                    </button>
                    {open && <FormGrid>{advanced.map(row)}</FormGrid>}
                </>
            )}
        </section>
    )
}

export function TimingDefaultsModal({ opened, onClose }: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const configEditing = supportsConfigEditing(service) ? service : null
    const featureBitmask = service?.limits?.featureBitmask ?? 0

    const [values, setValues] =
        useState<Record<TimingFieldKey, number>>(zeroSeed)
    const initialRef = useRef<Record<TimingFieldKey, number>>(values)
    const [saving, setSaving] = useState(false)
    // The fields the device's parts hold, as the parts describe them.
    const [held, setHeld] = useState<
        ReadonlyMap<TimingFieldKey, TimingFieldDef>
    >(() => new Map())
    const parts = service?.sensor

    useEffect(() => {
        if (!opened || !parts) return
        let live = true
        parts
            .getSensors()
            .then((list) => {
                if (live) setHeld(partTimingFields(list))
            })
            // Without the part list the plain fields still apply.
            .catch((e: unknown) =>
                console.warn('Timing: the device parts could not be read', e),
            )
        return () => {
            live = false
        }
    }, [opened, parts])

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
        // commit() resolves to nothing, so success is a flag, not the result.
        const saved = await saveWithToast(
            async () => {
                await service.commit()
                return true
            },
            'Timing defaults saved',
            'Failed to save timing defaults',
        )
        setSaving(false)
        if (saved) onClose()
    }

    const row = (f: TimingFieldDef): JSX.Element => {
        const supported = fieldSupported(f, featureBitmask)
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
                            [f.key]: parseInt(e.target.value, 10) || 0,
                        }))
                    }
                    disabled={saving}
                />
            </FormRow>
        )
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
                {groupedTimingFields(timingFieldsFor(held)).map(
                    ([group, fields]) => (
                        <TimingSection
                            key={group}
                            group={group}
                            fields={fields}
                            row={row}
                        />
                    ),
                )}
            </div>
        </Modal>
    )
}
