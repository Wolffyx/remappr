import { describe, expect, it, vi } from 'vitest'
import type { EncoderAction, KeyAction } from '@firmware/types'
import type { EncoderApi } from '@firmware/service'
import { encoderEditCommand } from './encoderEditCommand'

const act = (name: string): KeyAction =>
    ({ kind: 'test', params: [], label: { primary: name } }) as KeyAction

const VOLD = act('Vol-')
const VOLU = act('Vol+')
const STOP = act('Stop')

interface Rig {
    api: EncoderApi
    setEncoder: ReturnType<typeof vi.fn>
    apply: (enc: EncoderAction) => void
    device: Record<0 | 1, KeyAction>
    view: () => EncoderAction
    before: EncoderAction
}

/** A fake device holding one encoder, and the editor view mirrored by apply. */
function rig(opts: { failOn?: { dir: 0 | 1; action: KeyAction } } = {}): Rig {
    const device: Record<0 | 1, KeyAction> = { 0: VOLU, 1: VOLD }
    const setEncoder = vi.fn(
        async (_l: number, _s: number, dir: 0 | 1, action: KeyAction) => {
            if (dir === opts.failOn?.dir && action === opts.failOn.action)
                throw new Error('rejected')
            device[dir] = action
        },
    )
    const api: EncoderApi = { setEncoder }
    let view: EncoderAction = { cw: VOLU, ccw: VOLD }
    const apply = (enc: EncoderAction): void => {
        view = enc
    }
    return {
        api,
        setEncoder,
        apply,
        device,
        view: (): EncoderAction => view,
        before: { cw: VOLU, ccw: VOLD },
    }
}

describe('encoderEditCommand', () => {
    it('writes one direction and undoes it', async () => {
        const r = rig()
        const cmd = encoderEditCommand({
            api: r.api,
            layerId: 7,
            slot: 0,
            before: r.before,
            patch: { ccw: STOP },
            apply: r.apply,
        })!
        const undo = await cmd()
        expect(r.setEncoder).toHaveBeenCalledOnce()
        expect(r.setEncoder).toHaveBeenCalledWith(7, 0, 1, STOP)
        expect(r.view()).toEqual({ cw: VOLU, ccw: STOP })

        await undo()
        expect(r.device).toEqual({ 0: VOLU, 1: VOLD })
        expect(r.view()).toEqual({ cw: VOLU, ccw: VOLD })
    })

    it('swaps both directions in one command', async () => {
        const r = rig()
        const cmd = encoderEditCommand({
            api: r.api,
            layerId: 0,
            slot: 0,
            before: r.before,
            patch: { cw: VOLD, ccw: VOLU },
            apply: r.apply,
        })!
        const undo = await cmd()
        expect(r.device).toEqual({ 0: VOLD, 1: VOLU })
        await undo()
        expect(r.device).toEqual({ 0: VOLU, 1: VOLD })
    })

    it('is null when nothing changes', () => {
        const r = rig()
        const cmd = encoderEditCommand({
            api: r.api,
            layerId: 0,
            slot: 0,
            before: r.before,
            patch: { cw: VOLU },
            apply: r.apply,
        })
        expect(cmd).toBeNull()
    })

    it('rolls the view and the device back when a write fails', async () => {
        // Writes go in display order: the swap's ccw write lands, then its cw
        // write is rejected — the landed ccw write must be put back too.
        const r = rig({ failOn: { dir: 0, action: VOLD } })
        const cmd = encoderEditCommand({
            api: r.api,
            layerId: 0,
            slot: 0,
            before: r.before,
            patch: { cw: VOLD, ccw: VOLU },
            apply: r.apply,
        })!
        await expect(cmd()).rejects.toThrow('rejected')
        expect(r.setEncoder).toHaveBeenCalledWith(0, 0, 1, VOLU)
        expect(r.view()).toEqual({ cw: VOLU, ccw: VOLD })
        expect(r.device).toEqual({ 0: VOLU, 1: VOLD })
    })
})
