// Pattern check: no GoF pattern (-) — rejected — page view composing the mouse
// sections over one draft; reads and saves through useDeviceConfig.
//
// Where a host lands after connecting to a mouse (kind 'mouse'), or opening a
// mouse from the dongle's roster. A mouse has no keymap: its config is a
// `remappr.device` document (pointer, curve, buttons, radio) plus the live
// MOUSE controls. Through the dongle the view is read-only: saving needs the
// mouse on USB.
import { JSX, useEffect, useMemo, useState } from 'react'
import {
    ArrowLeft,
    Info,
    Mouse,
    Power,
    RefreshCw,
    RotateCcw,
    Save,
} from 'lucide-react'
import type { MotionConfig } from '@firmware'

import useConnectionStore from '@/stores/connectionStore'
import { Button } from '@/ui/button'

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
import {
    MouseButtonsSection,
    MouseCurveSection,
    MousePointerSection,
    RadioSection,
} from './MouseConfigSections'
import { useDeviceConfig } from './useDeviceConfig'

export function MouseLanding(): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const communication = useConnectionStore((s) => s.communication)
    const parentService = useConnectionStore((s) => s.parentService)
    const returnToParent = useConnectionStore((s) => s.returnToParent)
    const disconnect = useConnectionStore((s) => s.disconnect)

    const device = service?.device
    const motion = service?.motion
    const { snapshot, loading, error, saving, reload, save } =
        useDeviceConfig(device)
    const [mouse, setMouse] = useState<MouseDraft>(() => mouseDraft(undefined))
    const [radio, setRadio] = useState<RadioDraft>(() => radioDraft(undefined))
    const [motionCfg, setMotionCfg] = useState<MotionConfig | null>(null)
    const [liveKey, setLiveKey] = useState(0)

    useEffect(() => {
        if (!snapshot) return
        // Re-seed the form whenever a (re-)read lands.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMouse(mouseDraft(snapshot.config.mouse))
        setRadio(radioDraft(snapshot.config.radio))
    }, [snapshot])

    const range: DpiRange | null =
        motionCfg && motionCfg.dpiMax > 0
            ? { min: motionCfg.dpiMin, max: motionCfg.dpiMax }
            : null
    const stored = snapshot?.config
    const m = useMemo(
        () => mouseFromDraft(mouse, stored?.mouse, range),
        // range is rebuilt each render; its bounds are what matter
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mouse, stored, range?.min, range?.max],
    )
    const r = useMemo(
        () => radioFromDraft(radio, stored?.radio),
        [radio, stored],
    )
    const errors = { ...m.errors, ...r.errors }
    const blocked = Object.keys(errors).length > 0
    const dirty =
        !!stored &&
        (!sameSection(m.mouse, stored.mouse) ||
            !sameSection(r.radio, stored.radio))
    const writable = !!device?.writable
    const disabled = saving || !writable

    const handleSave = async (): Promise<void> => {
        if (!stored || blocked) return
        const ok = await save(
            withSections(stored, { mouse: m.mouse, radio: r.radio }),
        )
        // A save replaces the live DPI / acceleration / wheel values.
        if (ok) setLiveKey((k) => k + 1)
    }

    const revert = (): void => {
        if (!stored) return
        setMouse(mouseDraft(stored.mouse))
        setRadio(radioDraft(stored.radio))
    }

    const name = service?.deviceInfo.name?.trim() || 'Remappr Mouse'
    const via = parentService
        ? `via ${parentService.deviceInfo.name?.trim() || 'dongle'}`
        : communication === 'ble'
          ? 'BLE'
          : 'USB'

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                <Mouse className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{name}</div>
                    <div className="text-[11px] text-muted-foreground">
                        Mouse · Connected · {via}
                        {snapshot &&
                            (snapshot.stored
                                ? ` · settings v${snapshot.configVersion}`
                                : ' · default settings')}
                    </div>
                </div>
                {parentService && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={returnToParent}
                    >
                        <ArrowLeft className="mr-1.5 size-3.5" />
                        Back to dongle
                    </Button>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        reload()
                        setLiveKey((k) => k + 1)
                    }}
                    disabled={loading}
                >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Refresh
                </Button>
                {!parentService && (
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void disconnect()}
                    >
                        <Power className="mr-1.5 size-3.5" />
                        Disconnect
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-auto p-5">
                <div className="mx-auto flex max-w-3xl flex-col gap-4">
                    {!writable && (
                        <div className="flex items-start gap-2 rounded-[10px] border border-border bg-muted/40 p-3 text-xs">
                            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                            <span>
                                Read-only through the dongle. Connect the mouse
                                over USB to change its settings.
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
                    {!device ? (
                        <p className="text-sm text-muted-foreground">
                            This mouse firmware has no saved settings.
                        </p>
                    ) : loading && !snapshot ? (
                        <p className="text-sm text-muted-foreground">
                            Reading settings…
                        </p>
                    ) : error && !snapshot ? (
                        <div className="rounded-[10px] border border-destructive/40 p-4 text-sm">
                            <p className="font-medium">
                                Could not read the mouse settings
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {error}
                            </p>
                        </div>
                    ) : (
                        <>
                            <MousePointerSection
                                value={mouse}
                                onChange={setMouse}
                                errors={errors}
                                disabled={disabled}
                                range={range}
                            />
                            <MouseCurveSection
                                value={mouse.curve}
                                onChange={(curve) =>
                                    setMouse((d) => ({ ...d, curve }))
                                }
                                errors={errors}
                                disabled={disabled}
                            />
                            <MouseButtonsSection
                                value={mouse.buttons}
                                onChange={(buttons) =>
                                    setMouse((d) => ({ ...d, buttons }))
                                }
                                disabled={disabled}
                            />
                            <RadioSection
                                value={radio}
                                onChange={setRadio}
                                errors={errors}
                                disabled={disabled}
                            />
                        </>
                    )}
                </div>
            </div>

            {device && snapshot && writable && (
                <div className="flex items-center gap-2 border-t border-border px-5 py-3">
                    <Button
                        size="sm"
                        onClick={() => void handleSave()}
                        disabled={disabled || !dirty || blocked}
                    >
                        <Save className="mr-1.5 size-3.5" />
                        {saving ? 'Saving…' : 'Save to mouse'}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={revert}
                        disabled={saving || !dirty}
                    >
                        <RotateCcw className="mr-1.5 size-3.5" />
                        Revert
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                        {blocked
                            ? 'Fix the marked fields to save.'
                            : dirty
                              ? 'Unsaved changes.'
                              : 'Saved settings shown.'}
                    </span>
                </div>
            )}
        </div>
    )
}
