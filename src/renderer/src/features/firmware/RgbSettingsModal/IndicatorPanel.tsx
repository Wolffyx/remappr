// pattern-check: skip — presentational indicator editor; reads/writes the rgb
// facade directly, no abstraction.
//
// Friendly OS-lock indicator editor (caps/num/scroll/compose/kana). The board
// reports which indicators it physically has (`supported`); we show a per-
// indicator on/off switch plus one shared colour picker — matching the firmware,
// which drives every indicator from a single HSV and lights each only while its
// OS lock is active. Toggles write immediately; colour drags debounce. Footer
// Save persists (set only updates RAM until the 0xA8 SAVE).
import { useCallback, useEffect, useRef, useState } from 'react'

import type {
    HsvColor,
    IndicatorConfig,
    IndicatorFlags,
} from '@firmware/service'
import { saveWithToast } from '@/lib/saveWithToast'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'

import { ColorPicker } from './ColorPicker'
import type { IndicatorRgb } from './indicators'

interface Props {
    rgb: IndicatorRgb
}

const WRITE_DEBOUNCE_MS = 90

const INDICATORS: { key: keyof IndicatorFlags; label: string }[] = [
    { key: 'numLock', label: 'Num Lock' },
    { key: 'capsLock', label: 'Caps Lock' },
    { key: 'scrollLock', label: 'Scroll Lock' },
    { key: 'compose', label: 'Compose' },
    { key: 'kana', label: 'Kana' },
]

export function IndicatorPanel({ rgb }: Props): JSX.Element {
    const [cfg, setCfg] = useState<IndicatorConfig | null>(null)

    useEffect(() => {
        let cancelled = false
        void (async () => {
            const r = await saveWithToast(
                () => rgb.getIndicators(),
                null,
                'Indicators read failed',
            )
            if (!cancelled && r) setCfg(r)
        })()
        return (): void => {
            cancelled = true
        }
    }, [rgb])

    // Debounced device write: a colour drag updates the UI every frame but writes
    // to the keyboard at most once per WRITE_DEBOUNCE_MS; toggles write at once.
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const write = useCallback(
        (next: IndicatorConfig, immediate: boolean): void => {
            if (timer.current) clearTimeout(timer.current)
            const send = (): void => {
                void saveWithToast(
                    () => rgb.setIndicators(next),
                    null,
                    'Indicators write failed',
                )
            }
            if (immediate) send()
            else timer.current = setTimeout(send, WRITE_DEBOUNCE_MS)
        },
        [rgb],
    )
    useEffect(
        () => (): void => {
            if (timer.current) clearTimeout(timer.current)
        },
        [],
    )

    if (!cfg) {
        return (
            <div className="text-xs text-muted-foreground">
                Reading indicator settings…
            </div>
        )
    }

    const supported = INDICATORS.filter(({ key }) => cfg.supported[key])
    if (supported.length === 0) {
        return (
            <div className="text-xs text-muted-foreground">
                This keyboard has no OS-lock indicator LEDs.
            </div>
        )
    }

    // `on` = indicator enabled → the firmware's disable flag is the inverse.
    const toggle = (key: keyof IndicatorFlags, on: boolean): void => {
        const next: IndicatorConfig = {
            ...cfg,
            disabled: { ...cfg.disabled, [key]: !on },
        }
        setCfg(next)
        write(next, true)
    }
    const recolor = (color: HsvColor): void => {
        const next: IndicatorConfig = { ...cfg, color }
        setCfg(next)
        write(next, false)
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Indicators light only while their lock is active (e.g. Num Lock
                on). All indicators share one colour.
            </p>
            <div className="flex flex-col gap-2">
                {supported.map(({ key, label }) => (
                    <div
                        key={key}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                        <Label
                            htmlFor={`ind-${key}`}
                            className="text-xs font-medium"
                        >
                            {label}
                        </Label>
                        <Switch
                            id={`ind-${key}`}
                            checked={!cfg.disabled[key]}
                            onCheckedChange={(on): void => toggle(key, on)}
                        />
                    </div>
                ))}
            </div>
            <div className="rounded-xl border p-3">
                <div className="mb-2 text-xs font-semibold">
                    Indicator colour
                </div>
                <ColorPicker value={cfg.color} onChange={recolor} />
            </div>
        </div>
    )
}
