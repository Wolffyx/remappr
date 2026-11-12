// pattern-check: skip — unit tests for the host feed
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HostValuesApi } from '@firmware/service'
import { feedValues, planFeed, startHostFeed } from './hostFeed'

describe('host feed', () => {
    afterEach(() => vi.useRealTimers())

    it('plans each key from where it comes, leaves out what nothing answers', () => {
        expect(
            planFeed([
                'time',
                'cpu',
                'user3',
                'notification',
                'mediaTitle',
                '0x7f',
            ]),
        ).toEqual({
            time: true,
            stats: ['cpu', 'mediaTitle'],
            texts: ['user3'],
        })
        expect(planFeed([])).toEqual({ time: false, stats: [], texts: [] })
    })

    it('pushes only what has a value now', () => {
        const now = new Date(0)
        const plan = planFeed([
            'time',
            'cpu',
            'ram',
            'mediaTitle',
            'user0',
            'user1',
        ])
        expect(
            feedValues(
                plan,
                now,
                { cpu: 12, mediaTitle: '' },
                { user0: 'Hi', user1: '' },
            ),
        ).toEqual([
            ['time', now],
            ['cpu', 12],
            ['user0', 'Hi'],
        ])
    })

    it('asks the keys, pushes once a second, stops', async () => {
        vi.useFakeTimers()
        const set = vi.fn(async () => {})
        const keys = vi.fn(async () => ['cpu', 'user0'])
        const api: HostValuesApi = { keys, set, clear: vi.fn() }
        const readStats = vi.fn(async () => ({ cpu: 7 }))
        const stop = startHostFeed(api, {
            texts: () => ({ user0: 'note' }),
            readStats,
            keysEveryMs: 60_000,
        })
        await vi.advanceTimersByTimeAsync(0)
        expect(readStats).toHaveBeenCalledWith(['cpu'])
        expect(set.mock.calls).toEqual([
            ['cpu', 7],
            ['user0', 'note'],
        ])
        await vi.advanceTimersByTimeAsync(1000)
        expect(set).toHaveBeenCalledTimes(4)
        expect(keys).toHaveBeenCalledTimes(1)
        stop()
        await vi.advanceTimersByTimeAsync(5000)
        expect(set).toHaveBeenCalledTimes(4)
    })

    it('keeps going after a failed push', async () => {
        vi.useFakeTimers()
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        let fail = true
        const set = vi.fn(async () => {
            if (fail) throw new Error('busy')
        })
        const api: HostValuesApi = {
            keys: async () => ['user0'],
            set,
            clear: vi.fn(),
        }
        const stop = startHostFeed(api, { texts: () => ({ user0: 'x' }) })
        await vi.advanceTimersByTimeAsync(0)
        fail = false
        await vi.advanceTimersByTimeAsync(1000)
        expect(set).toHaveBeenCalledTimes(2)
        expect(warn).toHaveBeenCalledTimes(1)
        stop()
        warn.mockRestore()
    })
})
