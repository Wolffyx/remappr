// Pattern check: Observer (Tier 1) — extended — a zustand store like the other stores/*: whoever reads a procedure status publishes it here, the inspector subscribes.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { SensorApi, SensorProcedureStatus } from '@firmware/service'

/**
 * Which procedures have a result stored on the device, as their status last
 * said (`hasResult`). Whoever reads a status notes it here (the procedure
 * runner in Device settings, the inspector when it opens), so an option that
 * needs a result follows a calibration the moment it ends. The results are
 * one sensor API's: a note from another (a different device) starts afresh.
 */
interface SensorResultsState {
    /** The sensor API `stored` was heard from. */
    sensor: SensorApi | null
    /** `index:procedure` → a result is stored; missing = not known. */
    stored: Readonly<Record<string, boolean>>
    note: (
        sensor: SensorApi,
        index: number,
        procedure: string,
        status: SensorProcedureStatus,
    ) => void
}

const resultKey = (index: number, procedure: string): string =>
    `${index}:${procedure}`

const useSensorResultsStore = create<SensorResultsState>()(
    devtools((set) => ({
        sensor: null,
        stored: {},
        note: (sensor, index, procedure, status) => {
            // A device that does not say teaches nothing.
            if (status.hasResult === undefined) return
            const hasResult = status.hasResult
            set((s) => ({
                sensor,
                stored: {
                    ...(s.sensor === sensor ? s.stored : {}),
                    [resultKey(index, procedure)]: hasResult,
                },
            }))
        },
    })),
)

/** Does `sensor`'s sensor `index` hold a result of `procedure`? Undefined
 *  when nobody has heard (or heard it from another sensor API). */
export const selectStored =
    (sensor: SensorApi | undefined, index: number, procedure: string) =>
    (s: SensorResultsState): boolean | undefined =>
        sensor !== undefined && s.sensor === sensor
            ? s.stored[resultKey(index, procedure)]
            : undefined

export default useSensorResultsStore
