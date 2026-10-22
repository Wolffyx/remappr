// Pattern check: no GoF pattern (-) — rejected — leaf views over service.sensor (readings meter, procedure runner); plain components, step/state labels as small maps.
//
// The sensor's part of a device's settings: its live readings (a meter per
// reading, e.g. how well it sees the surface) and the procedures it offers
// (e.g. a lift-off calibration), drawn from what the sensor describes. A
// procedure's result belongs to the unit, not to the saved settings, so a
// run here takes effect at once and no Save is involved. A read-only view
// shows the readings and cannot run the procedures.
import { JSX, useCallback, useEffect, useState } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type {
    SensorInfo,
    SensorMetricSpec,
    SensorProcedureSpec,
} from '@firmware/devices/types'
import type {
    SensorApi,
    SensorProcedureStatus,
    SensorProcedureStep,
} from '@firmware/service'

import { cn } from '@/lib/cn'
import useSensorResultsStore from '@/stores/sensorResultsStore'
import { Button } from '@/ui/button'

import { SettingsSection } from './SettingRows'
import { useSensorPoll } from './useSensorPoll'

const READINGS_POLL_MS = 250
const STATUS_POLL_MS = 250

const message = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

/** The sensor that moves the pointer: the first of class pointer, else the
 *  first the device has. */
const pointerOf = (list: readonly SensorInfo[]): SensorInfo | null =>
    list.find((s) => s.cls === 'pointer') ?? list[0] ?? null

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

function Meter({
    spec,
    value,
}: {
    spec: SensorMetricSpec
    value: number | undefined
}): JSX.Element {
    // A reading that is only ever 0 or 1 is a yes / no.
    if (spec.max === 1) {
        return (
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{spec.label}</span>
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-caption font-semibold',
                        value
                            ? 'bg-warning/15 text-warning'
                            : 'bg-muted text-muted-foreground',
                    )}
                >
                    {value === undefined ? '—' : value ? 'Yes' : 'No'}
                </span>
            </div>
        )
    }
    const pct =
        value === undefined ? 0 : Math.min(100, (value / spec.max) * 100)
    return (
        <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
                <span className="font-medium">{spec.label}</span>
                <span className="font-mono text-muted-foreground">
                    {value ?? '—'} / {spec.max}
                </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

function SensorReadings({
    api,
    index,
    metrics,
}: {
    api: SensorApi
    index: number
    metrics: readonly SensorMetricSpec[]
}): JSX.Element {
    const read = useCallback(() => api.getMetrics(index), [api, index])
    const { value, failing } = useSensorPoll(read, READINGS_POLL_MS)
    return (
        <div className="flex flex-col gap-2.5">
            {metrics.map((m) => (
                <Meter
                    key={m.name}
                    spec={m}
                    value={value?.find((r) => r.name === m.name)?.value}
                />
            ))}
            {failing && (
                <p className="text-caption text-muted-foreground">
                    Readings pause while the sensor is busy.
                </p>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/** One procedure: its steps, progress and result, and the buttons that move
 *  it on. The status is polled while it runs (a counting phase ends by
 *  itself). A result kept from an earlier run (the status's `hasResult`) is
 *  shown while idle, and only then can it be forgotten; a device that does
 *  not say keeps the button. Every status goes to the shared results store,
 *  which the inspector reads. */
function ProcedureRunner({
    api,
    index,
    proc,
}: {
    api: SensorApi
    index: number
    proc: SensorProcedureSpec
}): JSX.Element {
    const [status, setStatus] = useState<SensorProcedureStatus | null>(null)
    const [busy, setBusy] = useState(false)
    const state = status?.state ?? 'idle'

    useEffect(() => {
        api.getProcedureStatus(index, proc.name)
            .then(setStatus)
            .catch((e: unknown) =>
                toast.error(`Failed to read the ${proc.label.toLowerCase()}`, {
                    description: message(e),
                }),
            )
    }, [api, index, proc])

    // Whatever the device says about a stored result, the inspector hears:
    // "Calibrated" opens the moment a calibration ends.
    useEffect(() => {
        if (status) {
            useSensorResultsStore.getState().note(api, index, proc.name, status)
        }
    }, [api, index, proc.name, status])

    useEffect(() => {
        if (state !== 'running') return
        const id = setInterval(() => {
            // A missed poll keeps the last status; the next one catches up.
            api.getProcedureStatus(index, proc.name)
                .then(setStatus)
                .catch(() => undefined)
        }, STATUS_POLL_MS)
        return () => clearInterval(id)
    }, [api, index, proc.name, state])

    const run = async (step: SensorProcedureStep): Promise<void> => {
        setBusy(true)
        try {
            setStatus(await api.runProcedure(index, proc.name, step))
        } catch (e) {
            toast.error(`${proc.label}: that step did not go through`, {
                description: message(e),
            })
        } finally {
            setBusy(false)
        }
    }

    const disabled = busy || !api.writable
    // A device that does not say whether a result is stored: a finished run
    // left one.
    const stored = status?.hasResult ?? (state === 'done' && proc.hasResult)
    const canForget =
        proc.hasResult && status !== null && status.hasResult !== false
    const phase = status?.phase ?? 0
    const counting = state === 'running' && (status?.total ?? 0) > 0
    const pct = counting ? (status!.progress / status!.total) * 100 : 0

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{proc.label}</span>
                {state === 'done' && (
                    <span className="flex items-center gap-1 text-xs text-success">
                        <Check className="size-3.5" /> Done
                    </span>
                )}
                {state === 'failed' && (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                        <TriangleAlert className="size-3.5" /> Did not finish
                    </span>
                )}
            </div>

            {state === 'running' ? (
                <div className="flex flex-col gap-2">
                    <p className="text-xs">
                        <span className="font-semibold">
                            Step {phase} of {proc.phases.length}.
                        </span>{' '}
                        {proc.phases[phase - 1] ?? ''}
                    </p>
                    {counting && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-200"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    )}
                </div>
            ) : (
                <ol className="list-decimal pl-4 text-xs text-muted-foreground">
                    {proc.phases.map((p) => (
                        <li key={p}>{p}</li>
                    ))}
                </ol>
            )}

            {state !== 'running' && stored && (
                <p className="text-caption text-muted-foreground">
                    A result is stored on this device. It stays, whatever
                    settings you save.
                </p>
            )}

            <div className="flex flex-wrap gap-2">
                {state === 'running' ? (
                    <>
                        {!counting && (
                            <Button
                                size="sm"
                                disabled={disabled}
                                onClick={() => void run('next')}
                            >
                                Next
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => void run('cancel')}
                        >
                            Cancel
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            size="sm"
                            disabled={disabled}
                            onClick={() => void run('begin')}
                        >
                            {state === 'idle' && !stored
                                ? 'Start'
                                : 'Run again'}
                        </Button>
                        {canForget && (
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={disabled}
                                onClick={() => void run('reset')}
                            >
                                Forget the result
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------

export function SensorPanel({ sensor }: { sensor: SensorApi }): JSX.Element {
    const [info, setInfo] = useState<SensorInfo | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        sensor
            .getSensors()
            .then((list) => setInfo(pointerOf(list)))
            .catch((e: unknown) => setError(message(e)))
    }, [sensor])

    const description = info
        ? `${info.model}: what it reads now, and what it can measure.`
        : undefined
    return (
        <SettingsSection title="Sensor" description={description}>
            {error ? (
                <p className="text-sm text-destructive">{error}</p>
            ) : !info ? (
                <p className="text-sm text-muted-foreground">
                    Reading the sensor…
                </p>
            ) : (
                <>
                    {info.metrics.length > 0 && (
                        <SensorReadings
                            api={sensor}
                            index={info.index}
                            metrics={info.metrics}
                        />
                    )}
                    {info.procedures.map((p) => (
                        <ProcedureRunner
                            key={p.name}
                            api={sensor}
                            index={info.index}
                            proc={p}
                        />
                    ))}
                    {info.metrics.length === 0 &&
                        info.procedures.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                This sensor reports no readings or procedures.
                            </p>
                        )}
                </>
            )}
        </SettingsSection>
    )
}
