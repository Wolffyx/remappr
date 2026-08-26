// Pattern check: no GoF pattern (-) — rejected — leaf view over the hold-tap /
// mod-morph def pools; edits local copies, stages diff patches; nothing to build.
//
// Config-blob behavior-definition editor. Remappr-only (gated on service.limits,
// narrowed to RemapprKeyboardService). Edits the custom hold-tap defs (flavor /
// timing / flags) and mod-morph defs (trigger + kept modifiers), stages the
// changed fields via setHoldTap/setModMorph, and pushes on commit(). A flag whose
// firmware feature bit is absent is annotated as ignored, not hidden.
import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'

import type { CanonHoldTapDef, CanonModMorph } from '@firmware/config'
import { supportsConfigEditing } from '@firmware/configEditing'

import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { cn } from '@/lib/cn'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

import {
    ALL_MODIFIERS,
    FLAVOR_OPTIONS,
    HOLD_TAP_FLAG_FIELDS,
    HOLD_TAP_NUM_FIELDS,
    type Flavor,
    featureSupported,
    holdTapPatch,
    modMorphPatch,
    modifierLabel,
    toggleModifier,
} from './behaviorFields'

interface Props {
    opened: boolean
    onClose: () => void
}

export function BehaviorDefsModal({ opened, onClose }: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const configEditing = supportsConfigEditing(service) ? service : null
    const featureBitmask = service?.limits?.featureBitmask ?? 0

    const [holdTaps, setHoldTaps] = useState<CanonHoldTapDef[]>([])
    const [modMorphs, setModMorphs] = useState<CanonModMorph[]>([])
    const origHT = useRef<CanonHoldTapDef[]>([])
    const origMM = useRef<CanonModMorph[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!opened || !configEditing) return
        const ht = configEditing.getHoldTaps()
        const mm = configEditing.getModMorphs()
        origHT.current = ht
        origMM.current = mm
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHoldTaps(ht.map((h) => ({ ...h })))
        setModMorphs(
            mm.map((m) => ({
                ...m,
                mods: [...m.mods],
                keepMods: [...(m.keepMods ?? [])],
            })),
        )
    }, [opened, configEditing])

    if (!configEditing) return <></>

    const patchHT = (i: number, patch: Partial<CanonHoldTapDef>): void =>
        setHoldTaps((prev) =>
            prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
        )

    const toggleMM = (
        i: number,
        field: 'mods' | 'keepMods',
        m: (typeof ALL_MODIFIERS)[number],
    ): void =>
        setModMorphs((prev) =>
            prev.map((mm, idx) =>
                idx === i
                    ? { ...mm, [field]: toggleModifier(mm[field] ?? [], m) }
                    : mm,
            ),
        )

    const handleSave = async (): Promise<void> => {
        if (!service) return
        let staged = 0
        holdTaps.forEach((h, i) => {
            const p = holdTapPatch(origHT.current[i], h)
            if (p) {
                configEditing.setHoldTap(i, p)
                staged++
            }
        })
        modMorphs.forEach((m, i) => {
            const p = modMorphPatch(origMM.current[i], m.mods, m.keepMods ?? [])
            if (p) {
                configEditing.setModMorph(i, p)
                staged++
            }
        })
        if (staged === 0) {
            onClose()
            return
        }
        setSaving(true)
        const r = await saveWithToast(
            () => service.commit(),
            'Behaviors saved',
            'Failed to save behaviors',
        )
        setSaving(false)
        if (r !== undefined) onClose()
    }

    const empty = holdTaps.length === 0 && modMorphs.length === 0

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Behaviors"
            subtitle="Custom hold-taps & mod-morphs pushed to the device"
            headerIcon={<SlidersHorizontal />}
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || empty}>
                        Save
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5 p-2 text-sm">
                {empty && (
                    <p className="text-muted-foreground">
                        This config has no custom hold-taps or mod-morphs.
                    </p>
                )}

                {holdTaps.length > 0 && (
                    <section className="flex flex-col gap-3">
                        <h3 className="font-semibold">Hold-taps</h3>
                        {holdTaps.map((h, i) => (
                            <div
                                key={h.id}
                                className="flex flex-col gap-2 rounded-lg border p-3"
                            >
                                <div className="font-mono text-xs">{h.id}</div>
                                <div className="flex items-center gap-2">
                                    <Label className="w-28 text-xs">
                                        Flavor
                                    </Label>
                                    <Select
                                        value={h.flavor ?? 'balanced'}
                                        onValueChange={(v) =>
                                            patchHT(i, { flavor: v as Flavor })
                                        }
                                    >
                                        <SelectTrigger className="w-56">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FLAVOR_OPTIONS.map((f) => (
                                                <SelectItem key={f} value={f}>
                                                    {f}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {HOLD_TAP_NUM_FIELDS.map((f) => (
                                    <div
                                        key={f.key}
                                        className="flex items-center gap-2"
                                    >
                                        <Label className="w-28 text-xs">
                                            {f.label}
                                        </Label>
                                        <Input
                                            type="number"
                                            min={f.min}
                                            max={f.max}
                                            value={h[f.key] ?? 0}
                                            onChange={(e) =>
                                                patchHT(i, {
                                                    [f.key]:
                                                        parseInt(
                                                            e.target.value,
                                                            10,
                                                        ) || 0,
                                                })
                                            }
                                            className="w-24"
                                            disabled={saving}
                                        />
                                        <span className="text-[10.5px] text-muted-foreground">
                                            ms
                                        </span>
                                    </div>
                                ))}
                                {HOLD_TAP_FLAG_FIELDS.map((f) => {
                                    const ok = featureSupported(
                                        f.feature,
                                        featureBitmask,
                                    )
                                    return (
                                        <div
                                            key={f.key}
                                            className="flex items-center gap-2"
                                        >
                                            <Switch
                                                checked={!!h[f.key]}
                                                onCheckedChange={(v) =>
                                                    patchHT(i, { [f.key]: v })
                                                }
                                                disabled={saving}
                                            />
                                            <Label
                                                className={cn(
                                                    'text-xs',
                                                    !ok &&
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                {f.label}
                                                {!ok &&
                                                    ' — ignored by this firmware'}
                                            </Label>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </section>
                )}

                {modMorphs.length > 0 && (
                    <section className="flex flex-col gap-3">
                        <h3 className="font-semibold">Mod-morphs</h3>
                        {modMorphs.map((m, i) => (
                            <div
                                key={m.id}
                                className="flex flex-col gap-2 rounded-lg border p-3"
                            >
                                <div className="font-mono text-xs">{m.id}</div>
                                {(['mods', 'keepMods'] as const).map(
                                    (field) => (
                                        <div
                                            key={field}
                                            className="flex flex-col gap-1"
                                        >
                                            <Label className="text-xs">
                                                {field === 'mods'
                                                    ? 'Trigger modifiers'
                                                    : 'Keep modifiers'}
                                            </Label>
                                            <div className="flex flex-wrap gap-1">
                                                {ALL_MODIFIERS.map((mod) => {
                                                    const on = (
                                                        m[field] ?? []
                                                    ).includes(mod)
                                                    return (
                                                        <Button
                                                            key={mod}
                                                            type="button"
                                                            size="sm"
                                                            variant={
                                                                on
                                                                    ? 'default'
                                                                    : 'outline'
                                                            }
                                                            onClick={() =>
                                                                toggleMM(
                                                                    i,
                                                                    field,
                                                                    mod,
                                                                )
                                                            }
                                                            disabled={saving}
                                                        >
                                                            {modifierLabel(mod)}
                                                        </Button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        ))}
                    </section>
                )}
            </div>
        </Modal>
    )
}
