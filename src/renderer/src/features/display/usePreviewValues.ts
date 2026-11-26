// pattern-check: skip — sampling hook for the display preview
//
// The values a display preview draws: this computer's where it has them
// (time, CPU, media, the texts), samples otherwise, refreshed once a second.
import { useEffect, useMemo, useState } from 'react'
import type { ScreenPreviewValue } from '@firmware/service'
import { HOST_STAT_KEYS } from '@shared/ipc-types'
import useHostTextStore from '@/stores/hostTextStore'
import { readHostStats } from './hostFeed'

/** What a device value looks like in the preview. */
const DEVICE_SAMPLES: Readonly<Record<string, ScreenPreviewValue>> = {
    activeLayer: 'Base',
    battery: 87,
    charging: 0,
    connection: 'USB',
    capsLock: 0,
    numLock: 1,
    wpm: 64,
}

/** Host values this computer has none of right now. */
const HOST_SAMPLES: Readonly<Record<string, ScreenPreviewValue>> = {
    cpu: 23,
    ram: 41,
    volume: 60,
    mediaTitle: 'Song title',
    mediaArtist: 'Artist',
    notification: 'New message',
}

const PREVIEW_MS = 1000

/** The preview's values, refreshed once a second. */
export function usePreviewValues(
    deviceName: string,
): (source: string) => ScreenPreviewValue | undefined {
    const texts = useHostTextStore((s) => s.texts)
    const [now, setNow] = useState(() => new Date())
    const [stats, setStats] = useState<Record<string, number | string>>({})
    useEffect(() => {
        let live = true
        const tick = (): void => {
            setNow(new Date())
            readHostStats(HOST_STAT_KEYS)
                .then((s) => {
                    if (live) setStats(s)
                })
                .catch(() => undefined) // samples stand in
        }
        tick()
        const id = setInterval(tick, PREVIEW_MS)
        return () => {
            live = false
            clearInterval(id)
        }
    }, [])
    return useMemo(() => {
        const host = (key: string): ScreenPreviewValue | undefined => {
            if (key === 'time') return now
            if (/^user\d+$/.test(key)) return texts[key] || undefined
            return stats[key] ?? HOST_SAMPLES[key]
        }
        return (source: string) =>
            source.startsWith('host.')
                ? host(source.slice(5))
                : source === 'deviceName'
                  ? deviceName
                  : DEVICE_SAMPLES[source]
    }, [now, stats, texts, deviceName])
}
