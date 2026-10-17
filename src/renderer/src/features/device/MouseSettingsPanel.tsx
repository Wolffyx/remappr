// Pattern check: no GoF pattern (-) — rejected — view over the mouse's staged document: the existing mouse sections write into the shared draft (DeviceConfigDraft) instead of saving on their own.
//
// The mouse settings the device stage does not show — pointer flags and
// wheel, the acceleration curve, the 2.4 GHz link, the live controls, and the
// sensor's readings and procedures —
// inside the device editor. Edits go into the same staged document as the
// button and CPI edits on the stage, so the header's Save writes them all.
// A read-only view reads the stored settings and changes nothing.
import { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { MotionConfig } from '@firmware'
import type { ConfigDevice } from '@firmware/config'
import type {
    DeviceConfigApi,
    MouseMotionApi,
    SensorApi,
} from '@firmware/service'
import {
    type DpiRange,
    type MouseDraft,
    mouseDraft,
    mouseFromDraft,
    type RadioDraft,
    radioDraft,
    radioFromDraft,
    sameSection,
    withSections,
} from './deviceForm'
import { MouseLiveSection } from './MouseLiveSection'
import { SensorPanel } from './SensorPanel'
import {
    MouseCurveSection,
    MousePointerSection,
    RadioSection,
} from './MouseConfigSections'
import { useDeviceConfig } from './useDeviceConfig'

interface Form {
    mouse: MouseDraft
    radio: RadioDraft
}

const formOf = (doc: ConfigDevice | null | undefined): Form => ({
    mouse: mouseDraft(doc?.mouse),
    radio: radioDraft(doc?.radio),
})

/** The staged document (writable mouse) or the stored one (read-only view). */
function useSettingsSource(device: DeviceConfigApi): {
    doc: ConfigDevice | null
    loading: boolean
    error: string | null
} {
    const draft = device.draft
    const [staged, setStaged] = useState<ConfigDevice | null>(
        () => draft?.get() ?? null,
    )
    useEffect(() => draft?.onChanged(setStaged), [draft])
    const read = useDeviceConfig(draft ? undefined : device)
    if (draft) return { doc: staged, loading: !staged, error: null }
    return {
        doc: read.snapshot?.config ?? null,
        loading: read.loading,
        error: read.error,
    }
}

export function MouseSettingsPanel({
    device,
    motion,
    sensor,
}: {
    device: DeviceConfigApi
    motion?: MouseMotionApi
    sensor?: SensorApi
}): JSX.Element {
    const draft = device.draft
    const { doc, loading, error } = useSettingsSource(device)
    const [form, setForm] = useState<Form>(() => formOf(doc))
    const [motionCfg, setMotionCfg] = useState<MotionConfig | null>(null)
    const [liveKey, setLiveKey] = useState(0)
    const writing = useRef(false)

    // Re-seed when the document changes under the panel (a stage edit, a
    // discard, a save) — not when the change is the panel's own write.
    useEffect(() => {
        if (writing.current) return

        setForm(formOf(doc))
    }, [doc])
    // A saved document replaces the live values: re-read them.
    useEffect(() => draft?.onChanged(() => setLiveKey((k) => k + 1)), [draft])

    const dpiMin = motionCfg?.dpiMin ?? 0
    const dpiMax = motionCfg?.dpiMax ?? 0
    const range: DpiRange | null = useMemo(
        () => (dpiMax > 0 ? { min: dpiMin, max: dpiMax } : null),
        [dpiMin, dpiMax],
    )
    const m = mouseFromDraft(form.mouse, doc?.mouse, range)
    const r = radioFromDraft(form.radio, doc?.radio)
    const errors = { ...m.errors, ...r.errors }
    const disabled = !draft

    const update = useCallback(
        (next: Form): void => {
            setForm(next)
            if (!draft || !doc) return
            const nm = mouseFromDraft(next.mouse, doc.mouse, range)
            const nr = radioFromDraft(next.radio, doc.radio)
            if (Object.keys({ ...nm.errors, ...nr.errors }).length) return
            if (
                sameSection(nm.mouse, doc.mouse) &&
                sameSection(nr.radio, doc.radio)
            )
                return
            writing.current = true
            draft.set(withSections(doc, { mouse: nm.mouse, radio: nr.radio }))
            writing.current = false
        },
        [draft, doc, range],
    )

    return (
        <div className="flex flex-col gap-4">
            {disabled && (
                <div className="flex items-start gap-2 rounded-[10px] border border-border bg-muted/40 p-3 text-xs">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>
                        Read-only view. Connect the mouse over USB to change its
                        settings.
                    </span>
                </div>
            )}
            {motion && (
                <MouseLiveSection
                    motion={motion}
                    refreshKey={liveKey}
                    onConfig={setMotionCfg}
                />
            )}
            {sensor && <SensorPanel sensor={sensor} />}
            {loading && !doc ? (
                <p className="text-sm text-muted-foreground">
                    Reading settings…
                </p>
            ) : error && !doc ? (
                <p className="text-sm text-destructive">{error}</p>
            ) : (
                <>
                    <MousePointerSection
                        value={form.mouse}
                        onChange={(mouse) => update({ ...form, mouse })}
                        errors={errors}
                        disabled={disabled}
                        range={range}
                    />
                    <MouseCurveSection
                        value={form.mouse.curve}
                        onChange={(curve) =>
                            update({ ...form, mouse: { ...form.mouse, curve } })
                        }
                        errors={errors}
                        disabled={disabled}
                    />
                    <RadioSection
                        value={form.radio}
                        onChange={(radio) => update({ ...form, radio })}
                        errors={errors}
                        disabled={disabled}
                    />
                    {draft && (
                        <p className="text-[11px] text-muted-foreground">
                            {Object.keys(errors).length
                                ? 'Fix the marked fields — they are not staged.'
                                : 'Changes are staged with the rest of the device; Save in the header writes them.'}
                        </p>
                    )}
                </>
            )}
        </div>
    )
}
