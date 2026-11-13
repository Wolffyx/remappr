// pattern-check: skip — unit tests for the host-stats parsers
import { describe, expect, it } from 'vitest'

import {
    cpuPercent,
    memPercent,
    parseVolume,
    pickMedia,
    readAskedStats,
    readHostStats,
} from './host-stats'

const v = (value: unknown): { signature: string; value: unknown } => ({
    signature: 's',
    value,
})

describe('host stats', () => {
    it('CPU: busy share between two asks', () => {
        expect(cpuPercent({ idle: 100, total: 200 }, null)).toBe(0)
        expect(
            cpuPercent({ idle: 175, total: 300 }, { idle: 100, total: 200 }),
        ).toBe(25)
        expect(
            cpuPercent({ idle: 175, total: 300 }, { idle: 175, total: 300 }),
        ).toBe(0)
    })

    it('RAM: MemAvailable when Linux has it, else os.freemem', () => {
        const meminfo =
            'MemTotal:       16000000 kB\nMemFree:  1000000 kB\nMemAvailable:    4000000 kB\n'
        expect(memPercent(meminfo)).toBe(75)
        const pct = memPercent(undefined)
        expect(pct).toBeGreaterThanOrEqual(0)
        expect(pct).toBeLessThanOrEqual(100)
    })

    it('volume from wpctl or pactl, muted = 0', () => {
        expect(parseVolume('Volume: 0.45\n')).toBe(45)
        expect(parseVolume('Volume: 0.45 [MUTED]\n')).toBe(0)
        expect(
            parseVolume(
                'Volume: front-left: 29491 /  45% / -20.81 dB,   front-right: 29491 /  45% / -20.81 dB\n',
            ),
        ).toBe(45)
        expect(parseVolume('nothing')).toBeUndefined()
    })

    it('media: the playing player, else a paused one', () => {
        const paused = {
            status: 'Paused',
            meta: { 'xesam:title': v('Old'), 'xesam:artist': v(['A']) },
        }
        const playing = {
            status: 'Playing',
            meta: { 'xesam:title': v('Song'), 'xesam:artist': v(['X', 'Y']) },
        }
        expect(pickMedia([paused, playing])).toEqual({
            title: 'Song',
            artist: 'X, Y',
        })
        expect(pickMedia([paused])).toEqual({ title: 'Old', artist: 'A' })
        expect(pickMedia([{ status: 'Stopped', meta: playing.meta }])).toEqual(
            {},
        )
        expect(
            pickMedia([
                {
                    status: 'Playing',
                    meta: { 'xesam:title': v('T'), 'xesam:artist': v(['']) },
                },
            ]),
        ).toEqual({ title: 'T' })
        expect(pickMedia([])).toEqual({})
    })

    it('answers only the keys asked, ignores what is not a key', async () => {
        const out = await readHostStats(['ram'])
        expect(Object.keys(out)).toEqual(['ram'])
        expect(Object.keys(await readAskedStats(['ram', 'nope', 3]))).toEqual([
            'ram',
        ])
        expect(await readAskedStats('ram')).toEqual({})
    })
})
