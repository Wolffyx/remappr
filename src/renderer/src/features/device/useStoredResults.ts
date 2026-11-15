// Pattern check: no GoF pattern (-) — rejected — a small hook: read each procedure's status once, then follow the shared results store.
import { useEffect } from 'react'

import useConnectionStore from '@/stores/connectionStore'
import useSensorResultsStore, {
    selectStored,
} from '@/stores/sensorResultsStore'

/**
 * For the connected device's sensor `index`: does each of `procedures` have
 * a result stored? Each status is read once (when the device, the sensor or
 * the list changes; the wire has no batch read, and a sensor lists one or
 * two procedures), then the shared store keeps it current as Device settings
 * runs them. The lookup answers undefined with no device, no index, or a
 * device that does not say.
 */
export function useStoredResults(
    index: number | undefined,
    procedures: readonly string[],
): (procedure: string) => boolean | undefined {
    const sensor = useConnectionStore((s) => s.service?.sensor)
    const results = useSensorResultsStore()
    const key = procedures.join('\n')

    useEffect(() => {
        if (!sensor || index === undefined || key === '') return
        const { note } = useSensorResultsStore.getState()
        for (const name of key.split('\n')) {
            sensor
                .getProcedureStatus(index, name)
                .then((st) => note(sensor, index, name, st))
                // An unread status leaves the option open: the device
                // still refuses it when no result is stored.
                .catch(() => undefined)
        }
    }, [sensor, index, key])

    return (procedure) =>
        index === undefined
            ? undefined
            : selectStored(sensor, index, procedure)(results)
}
