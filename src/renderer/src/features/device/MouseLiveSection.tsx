// Pattern check: no GoF pattern (-) — rejected — leaf view over the live MOUSE
// verbs (service.motion): read the state in force, apply a change at once.
//
// Live mouse controls: DPI, acceleration on/off and wheel direction. A change
// applies at once and stays (across reboots too) until settings are saved,
// which replaces it with the saved values.
import { JSX, useCallback, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import type { MotionConfig, MouseMotionApi } from '@firmware'

import { cn } from '@/lib/cn'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Segmented } from '@/ui/segmented'

import { SettingsSection } from './SettingRows'

type Accel = 'flat' | 'curve'
type Scroll = 'normal' | 'inverted'

const ACCEL_OPTIONS: { value: Accel; label: string }[] = [
    { value: 'flat', label: 'Flat' },
    { value: 'curve', label: 'Curve' },
]
const SCROLL_OPTIONS: { value: Scroll; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'inverted', label: 'Inverted' },
]

const message = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

export function MouseLiveSection({
    motion,
    refreshKey,
    onConfig,
}: {
    motion: MouseMotionApi
    /** Bump to re-read (a save replaces the live values). */
    refreshKey: number
    /** The motion state read from the mouse (DPI range for the editors). Must
     *  be stable (a state setter): it is a dependency of the read. */
    onConfig?: (cfg: MotionConfig) => void
}): JSX.Element {
    const [cfg, setCfg] = useState<MotionConfig | null>(null)
    const [dpi, setDpi] = useState('')
    const [busy, setBusy] = useState(false)

    const read = useCallback(async (): Promise<void> => {
        try {
            const c = await motion.getConfig()
            setCfg(c)
            setDpi(String(c.dpi))
            onConfig?.(c)
        } catch (e) {
            toast.error('Failed to read the mouse', { description: message(e) })
        }
    }, [motion, onConfig])

    useEffect(() => {
        // Read on mount and after each save (async-load-in-effect idiom).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void read()
    }, [read, refreshKey])

    const apply = async (
        label: string,
        fn: () => Promise<void>,
    ): Promise<void> => {
        setBusy(true)
        try {
            await fn()
        } catch (e) {
            toast.error(`Failed to set ${label}`, { description: message(e) })
        }
        await read()
        setBusy(false)
    }

    const ranged = !!cfg && cfg.dpiMax > 0
    const dpiValue = Number(dpi)
    const dpiOk =
        ranged &&
        Number.isInteger(dpiValue) &&
        dpiValue >= cfg.dpiMin &&
        dpiValue <= cfg.dpiMax
    const disabled = busy || !motion.writable || !cfg

    return (
        <SettingsSection
            title="Live"
            description="Applies at once and stays until you save settings, which replace it."
        >
            <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="live-dpi" className="w-40 shrink-0 text-xs">
                    DPI
                </Label>
                {ranged && (
                    <input
                        type="range"
                        aria-label="DPI"
                        min={cfg.dpiMin}
                        max={cfg.dpiMax}
                        step={cfg.dpiStep || 1}
                        value={dpiOk ? dpiValue : cfg.dpi}
                        onChange={(e) => setDpi(e.target.value)}
                        disabled={disabled}
                        className="w-48 accent-primary"
                    />
                )}
                <Input
                    id="live-dpi"
                    inputMode="numeric"
                    value={dpi}
                    onChange={(e) => setDpi(e.target.value)}
                    disabled={disabled || !ranged}
                    className="h-8 w-24"
                />
                <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled || !dpiOk || dpiValue === cfg?.dpi}
                    onClick={() =>
                        void apply('DPI', () => motion.setDpi(dpiValue))
                    }
                >
                    <Check className="mr-1.5 size-3.5" />
                    Apply
                </Button>
                {cfg && (
                    <span className="text-[11px] text-muted-foreground">
                        {ranged
                            ? `${cfg.dpiMin}–${cfg.dpiMax}, step ${cfg.dpiStep}`
                            : 'This mouse has a fixed resolution'}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2">
                <Label className="w-40 shrink-0 text-xs">Acceleration</Label>
                <div
                    className={cn(disabled && 'pointer-events-none opacity-50')}
                    aria-disabled={disabled}
                >
                    <Segmented
                        value={cfg?.accelProfile === 0 ? 'flat' : 'curve'}
                        options={ACCEL_OPTIONS}
                        onChange={(v) =>
                            !disabled &&
                            void apply('acceleration', () =>
                                motion.setAccelProfile(v === 'flat' ? 0 : 1),
                            )
                        }
                    />
                </div>
                <span className="text-[11px] text-muted-foreground">
                    Curve = the saved acceleration curve.
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Label className="w-40 shrink-0 text-xs">Wheel</Label>
                <div
                    className={cn(disabled && 'pointer-events-none opacity-50')}
                    aria-disabled={disabled}
                >
                    <Segmented
                        value={cfg?.scrollMode === 1 ? 'inverted' : 'normal'}
                        options={SCROLL_OPTIONS}
                        onChange={(v) =>
                            !disabled &&
                            void apply('wheel direction', () =>
                                motion.setScrollMode(v === 'inverted' ? 1 : 0),
                            )
                        }
                    />
                </div>
            </div>
        </SettingsSection>
    )
}
