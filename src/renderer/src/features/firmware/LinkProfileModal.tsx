// Pattern check: no GoF pattern (-) — rejected — leaf view over the node-bus link
// profile; local form state staged as one setNode() patch on save (mirrors
// NodeConfigModal / ConditionalLayersModal).
//
// Config-blob link/latency-profile editor (§8, N6, TBL_LINK_PROFILE). Remappr-only
// (gated on service.limits → RemapprKeyboardService). Picks a base profile
// (balanced / gaming / power-save) and per-knob overrides for the node-bus USART
// baud, the §6 election cadence, and a power tier. Every input is bounded by the
// device's live GET_LINK_LIMITS ranges (falling back to the firmware constraint
// table on a pre-N6 device) and validated with the same rules the firmware
// enforces at COMMIT, so the editor never offers — or saves — an out-of-range or
// cross-knob-inconsistent combo. Edits local state, stages one setNode({
// linkProfile }) patch, and pushes on commit().
import { useEffect, useRef, useState } from 'react'
import { Gauge, RotateCcw } from 'lucide-react'

import type { ConfigLinkProfile } from '@firmware/config'
import { supportsConfigEditing } from '@firmware/remappr/configEditing'
import type { LinkLimitKnob } from '@firmware/remappr/protocol'

import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Input } from '@/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

import {
    LINK_PROFILE_OPTIONS,
    LINK_KNOB_FIELDS,
    LINK_PROFILE_BASE,
    emptyLinkProfile,
    linkKnobValue,
    linkKnobRange,
    withLinkOverride,
    linkProfileError,
} from './linkProfileFields'

interface Props {
    opened: boolean
    onClose: () => void
}

type Profile = ConfigLinkProfile['profile']

const cloneProfile = (lp: ConfigLinkProfile): ConfigLinkProfile => ({
    profile: lp.profile,
    ...(lp.overrides ? { overrides: lp.overrides.map((o) => ({ ...o })) } : {}),
})

export function LinkProfileModal({ opened, onClose }: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const remappr = supportsConfigEditing(service) ? service : null

    const [form, setForm] = useState<ConfigLinkProfile>(emptyLinkProfile())
    // Live GET_LINK_LIMITS ranges; null until the read resolves (or on a pre-N6
    // device that can't answer) → the validators fall back to the static table.
    const [limits, setLimits] = useState<LinkLimitKnob[] | null>(null)
    const [liveLimits, setLiveLimits] = useState(false)
    const orig = useRef<ConfigLinkProfile>(emptyLinkProfile())
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!opened || !remappr) return
        const lp = remappr.getNode().linkProfile ?? emptyLinkProfile()
        orig.current = lp
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(cloneProfile(lp))
        setLimits(null)
        setLiveLimits(false)
        let cancelled = false
        remappr
            .getLinkLimits()
            .then((l) => {
                if (cancelled) return
                setLimits(l)
                setLiveLimits(true)
            })
            .catch(() => {
                // Pre-N6 firmware (no GET_LINK_LIMITS verb): keep the static table.
                if (!cancelled) setLiveLimits(false)
            })
        return () => {
            cancelled = true
        }
    }, [opened, remappr])

    if (!remappr) return <></>

    const liveOrUndef = limits ?? undefined
    const error = linkProfileError(form, liveOrUndef)

    const setProfile = (profile: Profile): void =>
        setForm((f) => ({ ...f, profile }))
    const setKnob = (knob: number, value: number): void =>
        setForm((f) => withLinkOverride(f, knob, value))
    const num = (v: string): number => parseInt(v, 10) || 0

    const handleSave = async (): Promise<void> => {
        if (!service || error) return
        if (JSON.stringify(form) === JSON.stringify(orig.current)) {
            onClose()
            return
        }
        remappr.setNode({ linkProfile: form })
        setSaving(true)
        const r = await saveWithToast(
            () => service.commit(),
            'Link profile saved',
            'Failed to save link profile',
        )
        setSaving(false)
        if (r !== undefined) onClose()
    }

    const profileHelp = LINK_PROFILE_OPTIONS.find(
        (o) => o.value === form.profile,
    )?.help

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Link profile"
            subtitle="Node-bus latency, election cadence, and power tier"
            headerIcon={<Gauge />}
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !!error}>
                        Save
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4 p-2 text-sm">
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Base profile</Label>
                    <Select
                        value={form.profile}
                        onValueChange={(v) => setProfile(v as Profile)}
                    >
                        <SelectTrigger className="w-64">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {LINK_PROFILE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {profileHelp}
                    </p>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Knob overrides</h3>
                        {!liveLimits && (
                            <span className="text-xs text-muted-foreground">
                                built-in ranges
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Each knob defaults to the base profile&apos;s value.
                        Change one to override it — the firmware bounds and
                        re-validates every value at save.
                    </p>

                    {LINK_KNOB_FIELDS.map((field) => {
                        const value = linkKnobValue(form, field.knob)
                        const range = linkKnobRange(field.knob, liveOrUndef)
                        const base = LINK_PROFILE_BASE[form.profile][field.knob]
                        const overridden = value !== base
                        return (
                            <div
                                key={field.knob}
                                className="flex flex-col gap-1"
                            >
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">
                                        {field.label}
                                        {field.unit ? ` (${field.unit})` : ''}
                                    </Label>
                                    {overridden && (
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            onClick={() =>
                                                setKnob(field.knob, base)
                                            }
                                            disabled={saving}
                                            aria-label={`Reset ${field.label} to the profile default`}
                                        >
                                            <RotateCcw className="size-4" />
                                        </Button>
                                    )}
                                </div>
                                {field.enumOptions ? (
                                    <Select
                                        value={String(value)}
                                        onValueChange={(v) =>
                                            setKnob(field.knob, parseInt(v, 10))
                                        }
                                    >
                                        <SelectTrigger className="w-64">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {field.enumOptions.map((o) => (
                                                <SelectItem
                                                    key={o.value}
                                                    value={String(o.value)}
                                                >
                                                    {o.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        type="number"
                                        min={range.min}
                                        max={range.max}
                                        value={value}
                                        onChange={(e) =>
                                            setKnob(
                                                field.knob,
                                                num(e.target.value),
                                            )
                                        }
                                    />
                                )}
                                <p className="text-xs text-muted-foreground">
                                    {field.help}
                                    {!field.enumOptions &&
                                        ` · ${range.min}–${range.max}`}
                                    {overridden
                                        ? ' · overridden'
                                        : ' · default'}
                                </p>
                            </div>
                        )
                    })}

                    {error && (
                        <span className="text-xs text-destructive">
                            {error}
                        </span>
                    )}
                </div>
            </div>
        </Modal>
    )
}
