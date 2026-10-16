// pattern-check: skip — assertions over the stored-results store
import { beforeEach, describe, expect, it } from 'vitest'
import type { SensorApi, SensorProcedureStatus } from '@firmware/service'
import useSensorResultsStore, { selectStored } from './sensorResultsStore'

const IDLE: SensorProcedureStatus = {
    state: 'idle',
    phase: 0,
    progress: 0,
    total: 0,
    ok: true,
}
const a = {} as SensorApi
const b = {} as SensorApi
const stored = (
    api: SensorApi,
    index: number,
    proc: string,
): boolean | undefined =>
    selectStored(api, index, proc)(useSensorResultsStore.getState())

describe('sensorResultsStore', () => {
    beforeEach(() =>
        useSensorResultsStore.setState({ sensor: null, stored: {} }),
    )

    it('keeps what a status says, per sensor index and procedure', () => {
        const { note } = useSensorResultsStore.getState()
        note(a, 0, 'liftCalibration', { ...IDLE, hasResult: true })
        note(a, 1, 'liftCalibration', { ...IDLE, hasResult: false })
        expect(stored(a, 0, 'liftCalibration')).toBe(true)
        expect(stored(a, 1, 'liftCalibration')).toBe(false)
        expect(stored(a, 0, 'other')).toBeUndefined()
        note(a, 0, 'liftCalibration', { ...IDLE, hasResult: false })
        expect(stored(a, 0, 'liftCalibration')).toBe(false)
    })

    it('learns nothing from a device that does not say', () => {
        const { note } = useSensorResultsStore.getState()
        note(a, 0, 'liftCalibration', { ...IDLE, hasResult: true })
        note(a, 0, 'liftCalibration', { ...IDLE, state: 'done' })
        expect(stored(a, 0, 'liftCalibration')).toBe(true)
    })

    it('starts afresh for another sensor API and answers only its own', () => {
        const { note } = useSensorResultsStore.getState()
        note(a, 0, 'liftCalibration', { ...IDLE, hasResult: true })
        expect(stored(b, 0, 'liftCalibration')).toBeUndefined()
        note(b, 0, 'other', { ...IDLE, hasResult: false })
        expect(stored(a, 0, 'liftCalibration')).toBeUndefined()
        expect(stored(b, 0, 'liftCalibration')).toBeUndefined()
        expect(stored(b, 0, 'other')).toBe(false)
        expect(
            selectStored(
                undefined,
                0,
                'other',
            )(useSensorResultsStore.getState()),
        ).toBeUndefined()
    })
})
