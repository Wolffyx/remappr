// pattern-check: skip — hook orchestrating perKeyPaintStore + rgb facade I/O; no abstraction
import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { HsvColor, KeyboardService } from '@firmware/service'
import usePerKeyPaintStore from '@/stores/perKeyPaintStore'
import useLightingCatalogStore from '@/stores/lightingCatalogStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { identityKeyLeds, ledRuns, ledSpan } from './perKeyLeds'

const PER_KEY_BATCH_MAX = 9
// Per-key sub-effect selector (per_key_rgb_type). Firmware enum
// (keychron_rgb_type.h): SOLID=0, BREATHING=1, REACTIVE_SIMPLE=2,
// REACTIVE_MULTI_WIDE=3, REACTIVE_SPLASH=4. SOLID(0) is the static display.
// Confirmed on a Keychron K5 (per-key paint lights the painted key).
const PER_KEY_STATIC_TYPE = 0
// Keychron exposes "Per Key RGB" as an RGB-matrix *effect*: per-key colours only
// display while that effect is the active one. Resolved by name in the board's
// parsed effect catalog when present, else from firmware via
// rgb.getPerKeyEffectMode() (Keychron's custom effect is absent from the VIA
// catalog — see keychron/rgb.ts).
const PER_KEY_EFFECT_RE = /per[\s-]?key/i

// pattern-check: skip one field added to the existing PaintApi shape
export interface PaintApi {
    /** Per-key RGB write is supported by the connected firmware. */
    available: boolean
    /** The keyboard holds painted colours in RAM only (RgbApi.perKeyVolatile):
     *  they are lost on unplug, and nothing is saved after a paint. */
    volatile: boolean
    active: boolean
    setActive: (active: boolean) => void
    brush: HsvColor
    setBrush: (c: HsvColor) => void
    /** canvas idx → colour (device HSV 0–255), for the glow. */
    perKeyColors: Array<HsvColor | null> | null
    onKeyPaint: (idx: number) => void
    onKeyEyedrop: (idx: number) => void
    /** Flush coalesced paint writes to the device (call at gesture end). */
    commitPaint: () => void
    fillAll: () => void
    clearAll: () => void
}

export function usePerKeyPaint(
    service: KeyboardService | null,
    keyCount: number,
): PaintApi {
    const rgb = service?.rgb
    const available = !!rgb?.setPerKeyColors
    const volatile = !!rgb?.perKeyVolatile
    // Persist after a paint, unless the colours live in RAM only: then a save
    // would only store the per-key effect over an empty buffer.
    const persist = useCallback(async (): Promise<void> => {
        if (!rgb?.perKeyVolatile) await rgb?.save?.()
    }, [rgb])

    const active = usePerKeyPaintStore((s) => s.active)
    const brush = usePerKeyPaintStore((s) => s.brush)
    const colors = usePerKeyPaintStore((s) => s.colors)
    const setActive = usePerKeyPaintStore((s) => s.setActive)
    const setBrush = usePerKeyPaintStore((s) => s.setBrush)
    const paint = usePerKeyPaintStore((s) => s.paint)
    const eyedrop = usePerKeyPaintStore((s) => s.eyedrop)
    const fillAllStore = usePerKeyPaintStore((s) => s.fillAll)
    const load = usePerKeyPaintStore((s) => s.load)
    const reset = usePerKeyPaintStore((s) => s.reset)

    // canvas idx → the LEDs under that key (RgbApi.getKeyLeds). A long
    // spacebar can have several; a key with none gets no writes.
    const keyLedsRef = useRef<number[][]>([])
    const ledsOf = useCallback(
        (idx: number): number[] => keyLedsRef.current[idx] ?? [idx],
        [],
    )
    // Coalesced drag writes: LED idx → latest brush colour. Repeated keys in a
    // sweep collapse to one entry; flushed as contiguous batches at gesture end
    // (one save() total) instead of a write+save per painted key.
    const pendingRef = useRef<Map<number, HsvColor>>(new Map())
    // Write-only firmware: the connection whose colours the store holds. The
    // store is the only record of what was painted, so keep it across visits
    // to paint mode and clear it only for a new connection.
    const blankSeededFor = useRef<typeof rgb>(undefined)

    // On entering paint mode: resolve the LED map, activate the device's per-key
    // mode, and seed the store with the keyboard's current per-key colours.
    useEffect(() => {
        if (!active || !available || keyCount <= 0 || !rgb) return
        let cancelled = false
        ;(async () => {
            const keyLeds =
                (await rgb.getKeyLeds?.(keyCount)) ?? identityKeyLeds(keyCount)
            if (cancelled) return
            keyLedsRef.current = keyLeds
            // Switch the active RGB-matrix effect to the board's "Per Key RGB"
            // mode — without this the keyboard keeps running its current effect
            // (Breathing, etc.) and never displays the per-key colour buffer.
            const catalog =
                useLightingCatalogStore.getState().catalog ??
                rgb.effectCatalog ??
                null
            let perKeyIdx =
                catalog?.effects.findIndex((n) => PER_KEY_EFFECT_RE.test(n)) ??
                -1
            // VIA catalogs omit Keychron's custom PER_KEY_RGB effect — ask the
            // firmware for its index (clamp-probe) when the name isn't listed.
            if (perKeyIdx < 0 && rgb.getPerKeyEffectMode) {
                perKeyIdx = (await rgb.getPerKeyEffectMode()) ?? -1
                if (cancelled) return
            }
            if (perKeyIdx >= 0 && rgb.getEffect && rgb.setEffect) {
                const cur = await rgb.getEffect()
                if (!cancelled && cur.mode !== perKeyIdx) {
                    await saveWithToast(
                        () => rgb.setEffect!({ ...cur, mode: perKeyIdx }),
                        null,
                        'Could not switch to the Per-key RGB effect',
                    )
                }
            } else {
                console.warn(
                    '[perkey] could not resolve "Per Key RGB" effect index — ' +
                        'per-key colours may not display on hardware',
                    { effects: catalog?.effects },
                )
            }
            if (cancelled) return
            // Select the per-key sub-effect (General = static colours).
            if (rgb.setPerKeyType) {
                await saveWithToast(
                    () => rgb.setPerKeyType!(PER_KEY_STATIC_TYPE),
                    null,
                    'Could not switch keyboard to per-key mode',
                )
            }
            // Seed from device colours (read sequentially; a key shows its
            // first LED's colour).
            // Write-only firmware can't report them: start a new connection
            // from a blank board, then keep what this session painted.
            if (!rgb.getPerKeyColors) {
                if (blankSeededFor.current !== rgb) {
                    blankSeededFor.current = rgb
                    load({})
                }
                return
            }
            const result = await saveWithToast(
                async () => {
                    const span = ledSpan(keyLeds)
                    const ledColors: HsvColor[] = []
                    for (let s = 0; s < span; s += PER_KEY_BATCH_MAX) {
                        const n = Math.min(PER_KEY_BATCH_MAX, span - s)
                        ledColors.push(...(await rgb.getPerKeyColors!(s, n)))
                    }
                    return ledColors
                },
                null,
                'Read per-key colours failed',
            )
            if (cancelled || !result) return
            const seeded: Record<number, HsvColor> = {}
            keyLeds.forEach(([led], idx) => {
                const c = led === undefined ? undefined : result[led]
                if (c) seeded[idx] = c
            })
            load(seeded)
        })()
        return (): void => {
            cancelled = true
        }
    }, [active, available, keyCount, rgb, load])

    // Write LED → colour in as few setPerKeyColors calls as possible, then
    // persist once.
    const writeLeds = useCallback(
        async (writes: ReadonlyMap<number, HsvColor>): Promise<void> => {
            if (!rgb?.setPerKeyColors) return
            for (const run of ledRuns(writes, PER_KEY_BATCH_MAX)) {
                await rgb.setPerKeyColors(run.start, run.colors)
            }
            await persist()
        },
        [rgb, persist],
    )

    const onKeyPaint = useCallback(
        (idx: number): void => {
            paint(idx) // instant store/glow update
            if (!rgb?.setPerKeyColors) return
            // Queue the write; flushed on commitPaint() at gesture end.
            const brush = usePerKeyPaintStore.getState().brush
            for (const led of ledsOf(idx))
                pendingRef.current.set(led, { ...brush })
        },
        [paint, rgb, ledsOf],
    )

    const commitPaint = useCallback((): void => {
        const pending = pendingRef.current
        if (!rgb?.setPerKeyColors || pending.size === 0) return
        pendingRef.current = new Map()
        void saveWithToast(
            () => writeLeds(pending),
            null,
            'Per-key write failed',
        )
    }, [rgb, writeLeds])

    const onKeyEyedrop = useCallback(
        (idx: number): void => eyedrop(idx),
        [eyedrop],
    )

    const fillAll = useCallback((): void => {
        const idxs = Array.from({ length: keyCount }, (_, i) => i)
        fillAllStore(idxs)
        pendingRef.current.clear() // fillAll writes directly; drop stale queue
        if (!rgb?.setPerKeyColors) return
        const brush = usePerKeyPaintStore.getState().brush
        const writes = new Map(
            idxs.flatMap(ledsOf).map((led) => [led, { ...brush }] as const),
        )
        void saveWithToast(
            () => writeLeds(writes),
            'Filled all keys',
            'Fill all failed',
        )
    }, [keyCount, fillAllStore, rgb, writeLeds, ledsOf])

    const clearAll = useCallback((): void => reset(), [reset])

    const perKeyColors = useMemo((): Array<HsvColor | null> | null => {
        if (!active) return null
        return Array.from({ length: keyCount }, (_, i) => colors[i] ?? null)
    }, [active, keyCount, colors])

    return {
        available,
        volatile,
        active,
        setActive,
        brush,
        setBrush,
        perKeyColors,
        onKeyPaint,
        onKeyEyedrop,
        commitPaint,
        fillAll,
        clearAll,
    }
}
