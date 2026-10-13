// Pattern check: no GoF pattern (-) — rejected — leaf settings view: reads the
// dongle's config, edits a draft, pushes it on Save; no abstraction to build.
//
// The dongle's own settings (TBL_DONGLE): pairing window, failsafe, offline
// horizon, pair-done replay, USB report wait and the NKRO routing. Pushed to
// the dongle itself (target 0) as a `remappr.device` document. A save applies
// at once and ends a live NKRO switch made since the last save.
import { JSX, useEffect, useMemo, useState } from 'react'
import { RefreshCw, RotateCcw, Save } from 'lucide-react'
import { DONGLE_FIELDS } from '@firmware/config'
import type { DeviceConfigApi } from '@firmware'

import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Segmented } from '@/ui/segmented'

import {
    type DongleDraft,
    dongleDraft,
    dongleFromDraft,
    type NkroChoice,
    sameSection,
    withSections,
} from './deviceForm'
import { NumberSettingRow, SettingsSection } from './SettingRows'
import { useDeviceConfig } from './useDeviceConfig'

const NKRO_OPTIONS: { value: NkroChoice; label: string }[] = [
    { value: 'keep', label: 'Leave as is' },
    { value: 'nkro', label: 'NKRO' },
    { value: 'boot', label: 'Boot 6KRO' },
]

export function DongleSettingsPanel({
    device,
    onSaved,
}: {
    device: DeviceConfigApi
    /** Called after a save, e.g. to re-read the live NKRO state. */
    onSaved?: () => void
}): JSX.Element {
    const { snapshot, loading, error, saving, reload, save } =
        useDeviceConfig(device)
    const [draft, setDraft] = useState<DongleDraft>(() =>
        dongleDraft(undefined),
    )

    // Re-seed the form whenever a (re-)read lands.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (snapshot) setDraft(dongleDraft(snapshot.config.dongle))
    }, [snapshot])

    const result = useMemo(() => dongleFromDraft(draft), [draft])
    const stored = snapshot?.config.dongle
    const dirty = !!snapshot && !sameSection(result.dongle, stored)
    const blocked = Object.keys(result.errors).length > 0

    const handleSave = async (): Promise<void> => {
        if (!snapshot || blocked) return
        const ok = await save(
            withSections(snapshot.config, { dongle: result.dongle }),
        )
        if (ok) onSaved?.()
    }

    if (loading && !snapshot) {
        return (
            <p className="text-sm text-muted-foreground">Reading settings…</p>
        )
    }
    if (error && !snapshot) {
        return (
            <div className="rounded-[10px] border border-destructive/40 p-4 text-sm">
                <p className="font-medium">
                    Could not read the dongle settings
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={reload}
                >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Try again
                </Button>
            </div>
        )
    }

    const disabled = saving || !device.writable
    return (
        <div className="flex max-w-2xl flex-col gap-4">
            <p className="text-xs text-muted-foreground">
                {snapshot?.stored
                    ? `Saved settings, version ${snapshot.configVersion}.`
                    : 'No saved settings: the dongle runs on its defaults.'}
            </p>

            <SettingsSection
                title="Keystroke routing"
                description="Which USB interface keystrokes go out on when settings are saved. NKRO sends every key; Boot 6KRO works in a BIOS. The switch at the top changes it at once, until the next save."
            >
                <div className="flex items-center gap-3">
                    <Label className="w-40 shrink-0 text-xs">On save</Label>
                    <Segmented
                        value={draft.nkro}
                        options={NKRO_OPTIONS}
                        onChange={(nkro) => setDraft((d) => ({ ...d, nkro }))}
                    />
                </div>
            </SettingsSection>

            <SettingsSection
                title="Pairing and nodes"
                description="How long pairing stays open and when a quiet node is released or shown offline."
            >
                {DONGLE_FIELDS.map((f) => (
                    <NumberSettingRow
                        key={f.key}
                        field={f}
                        value={draft.numbers[f.key]}
                        error={result.errors[f.key]}
                        disabled={disabled}
                        onChange={(v) =>
                            setDraft((d) => ({
                                ...d,
                                numbers: { ...d.numbers, [f.key]: v },
                            }))
                        }
                    />
                ))}
            </SettingsSection>

            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={() => void handleSave()}
                    disabled={disabled || !dirty || blocked}
                >
                    <Save className="mr-1.5 size-3.5" />
                    {saving ? 'Saving…' : 'Save to dongle'}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={saving || !dirty}
                    onClick={() => snapshot && setDraft(dongleDraft(stored))}
                >
                    <RotateCcw className="mr-1.5 size-3.5" />
                    Revert
                </Button>
                {blocked && (
                    <span className="text-[11px] text-destructive">
                        Fix the marked fields to save.
                    </span>
                )}
            </div>
        </div>
    )
}
