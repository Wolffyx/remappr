// Pattern check: Dispatch Map (Tier 0) — applied — step notes and refusals index const tables; the rest is the leaf view over service.joystick it was.
//
// The joystick settings the device stage does not show: calibration. It
// belongs to the stick, not to a saved config, so it applies at once and a
// save never replaces it. A guided capture (push it round the rim, let it go
// from each corner, finish) measures it and suggests the deadzones; the test
// shows how far the result reaches every way and where it settles at rest;
// undo goes back to the calibration before. The live readout polls the
// joystick while the panel is open.
import { Info } from 'lucide-react'
import { JSX, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type {
    AxisConfig,
    AxisState,
    DeadzoneSuggestion,
    JoystickApi,
    JoystickCalStep,
    JoystickStick,
} from '@firmware/service'

import { Button } from '@/ui/button'

import { CalibrationGuide } from './CalibrationGuide'
import { DeadzoneSuggestions } from './DeadzoneSuggestions'
import { SettingsSection } from './SettingRows'
import { StickTest } from './StickTest'
import { radius } from './stickGeometry'
import {
    useCalibrationCapture,
    type GuidePhase,
    type StickProgress,
} from './useCalibrationCapture'
import { useJoystickLive } from './useJoystickLive'
import { useStickTest } from './useStickTest'

const IDLE_POLL_MS = 100
/** While capturing or testing the stick's path matters, not just where it is. */
const ACTIVE_POLL_MS = 40
/** Seconds before Next and Finish unlock without full progress. */
const RIM_UNLOCK_S = 15
const RESTS_UNLOCK_S = 20
/** The rim counts as covered at this share of directions. */
const RIM_DONE = 0.95
/** A stick further out than this is not resting. */
const RESTING = 0.2
const AXIS_NAMES = ['X', 'Y', 'Z', 'Rx', 'Ry', 'Rz']

type Phase = 'idle' | GuidePhase

const message = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

/** Why a refused step was refused, when the firmware's status says little. */
const REFUSED: Readonly<Partial<Record<JoystickCalStep, string>>> = {
    finish: 'Push the stick round its whole rim and let it go, then Finish again.',
    undo: 'There is no earlier calibration to go back to.',
}

/** What a step that went through means, shown under the readout. */
const DONE_NOTE: Readonly<Partial<Record<JoystickCalStep, string>>> = {
    finish: 'Calibration saved on the stick. Test it below.',
    cancel: 'Cancelled. The stick keeps its previous calibration.',
    reset: 'Calibration reset to the default.',
    undo: 'Back to the calibration before. Undo again to return.',
}

/** Steps that change the stored calibration get a toast too. */
const TOASTED: ReadonlySet<JoystickCalStep> = new Set([
    'finish',
    'reset',
    'undo',
])

/** What stands in for the input rows while there are none. */
function lostOrEmpty(state: AxisState | null, lost: boolean): string {
    if (lost)
        return 'Could not read the joystick. Close this dialog and reconnect it.'
    if (!state) return 'Reading…'
    return 'This joystick has no analog inputs.'
}

/** The sticks to guide: as the joystick declares them, else its inputs in
 *  pairs. */
function sticksOf(
    joystick: JoystickApi,
    config: AxisConfig | null,
): JoystickStick[] {
    const declared = joystick.sticks()
    if (declared.length) return [...declared]
    const pairs = Math.floor((config?.axes.length ?? 0) / 2)
    return Array.from({ length: pairs }, (_, n) => ({
        controlId: `stick:${n}`,
        name: `Stick ${n + 1}`,
        x: 2 * n,
        y: 2 * n + 1,
    }))
}

/** Where `v` sits between `lo` and `hi`, 0..100. */
const pct = (v: number, lo: number, hi: number): number =>
    hi > lo ? Math.min(100, Math.max(0, ((v - lo) * 100) / (hi - lo))) : 50

function InputRow({
    index,
    raw,
    value,
    cfg,
}: {
    index: number
    raw: number
    value: number
    cfg: AxisConfig['axes'][number] | undefined
}): JSX.Element {
    const lo = cfg?.min ?? 0
    const hi = cfg?.max ?? 4095
    const axis = cfg ? (AXIS_NAMES[cfg.out] ?? 'off') : '—'
    const filter = cfg?.fuzz ? ` · filter ${cfg.fuzz}` : ''
    return (
        <div className="flex items-center gap-3 text-xs">
            <span className="w-24 shrink-0">
                Input {index + 1}{' '}
                <span className="text-muted-foreground">→ {axis}</span>
            </span>
            <div className="relative h-2 flex-1 rounded-full bg-muted">
                {cfg && (
                    <span
                        className="absolute top-0 h-2 w-px bg-muted-foreground"
                        style={{ left: `${pct(cfg.centre, lo, hi)}%` }}
                    />
                )}
                <span
                    className="absolute top-[-2px] size-3 -translate-x-1/2 rounded-full bg-primary"
                    style={{ left: `${pct(raw, lo, hi)}%` }}
                />
            </div>
            <span className="w-32 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {raw} · {Math.round((value * 100) / 32767)}%
            </span>
            <span className="w-44 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {cfg ? `${cfg.min}…${cfg.centre}…${cfg.max}${filter}` : ''}
            </span>
        </div>
    )
}

/** Seconds a capture step has run, while `running`; `restart` zeroes it. */
function useSeconds(running: boolean): [number, () => void] {
    const [s, setS] = useState(0)
    useEffect(() => {
        if (!running) return
        const id = setInterval(() => setS((n) => n + 1), 1000)
        return () => clearInterval(id)
    }, [running])
    return [s, useCallback(() => setS(0), [])]
}

/** Whether the step in progress may move on: its progress is complete, or
 *  it has run long enough that the hand may be done anyway. */
function ready(
    phase: Phase,
    progress: readonly StickProgress[],
    elapsed: number,
): boolean {
    if (phase === 'rim')
        return (
            progress.every((p) => p.covered >= RIM_DONE) ||
            elapsed >= RIM_UNLOCK_S
        )
    return (
        progress.every((p) => p.tally.done.size === 4) ||
        elapsed >= RESTS_UNLOCK_S
    )
}

export function JoystickSettingsPanel({
    joystick,
}: {
    joystick: JoystickApi
}): JSX.Element {
    const [config, setConfig] = useState<AxisConfig | null>(null)
    const [phase, setPhase] = useState<Phase>('idle')
    const [testing, setTesting] = useState(false)
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState<string | null>(null)
    const [suggestions, setSuggestions] = useState<
        readonly DeadzoneSuggestion[]
    >([])
    // A new calibration's suggestions start un-applied.
    const [round, setRound] = useState(0)
    const [elapsed, restartClock] = useSeconds(phase !== 'idle')

    const sticks = useMemo(() => sticksOf(joystick, config), [joystick, config])
    const priors = useMemo(() => config?.axes ?? [], [config])
    const capture = useCalibrationCapture(sticks, priors)
    const test = useStickTest(sticks, config?.axes ?? [])
    const { feed: feedCapture } = capture
    const { feed: feedTest } = test
    const onSample = useCallback(
        (s: AxisState) => {
            if (phase !== 'idle') feedCapture(s, phase)
            if (testing) feedTest(s)
        },
        [phase, testing, feedCapture, feedTest],
    )
    const active = phase !== 'idle' || testing
    const { state, lost } = useJoystickLive(
        joystick,
        active ? ACTIVE_POLL_MS : IDLE_POLL_MS,
        onSample,
    )

    const readConfig = useCallback(async (): Promise<void> => {
        try {
            setConfig(await joystick.getConfig())
        } catch (e) {
            toast.error('Failed to read the joystick', {
                description: message(e),
            })
        }
    }, [joystick])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void readConfig()
    }, [readConfig])

    /** Run `step`'s firmware calls; note and toast how it went. */
    const run = async (
        step: JoystickCalStep,
        body: () => Promise<void>,
    ): Promise<void> => {
        setBusy(true)
        try {
            await body()
            setNote(DONE_NOTE[step] ?? null)
            if (TOASTED.has(step)) toast.success(DONE_NOTE[step])
        } catch (e) {
            toast.error('Calibration step refused', {
                description: REFUSED[step] ?? message(e),
            })
        }
        setBusy(false)
    }

    const begin = (): Promise<void> =>
        run('begin', async () => {
            await joystick.calibrate('begin')
            capture.restart()
            setSuggestions([])
            setTesting(false)
            setPhase('rim')
            restartClock()
        })

    const next = (): void => {
        setPhase('rests')
        restartClock()
    }

    const finish = async (): Promise<void> => {
        const resting = capture
            .posOf(state)
            .every((p) => !p || radius(p) <= RESTING)
        if (!resting) {
            toast.info('Let go of the stick first.')
            return
        }
        await run('finish', async () => {
            await joystick.calibrate('centre')
            setSuggestions(await joystick.calibrate('finish'))
            setRound((r) => r + 1)
            setPhase('idle')
            test.clear()
            setTesting(true)
            await readConfig()
        })
    }

    const settle = (step: 'cancel' | 'reset' | 'undo'): Promise<void> =>
        run(step, async () => {
            await joystick.calibrate(step)
            setPhase('idle')
            if (step !== 'cancel') setSuggestions([])
            await readConfig()
        })

    const disabled = busy || !joystick.writable
    const inputs = state?.inputs ?? []
    const canUndo = !!config?.axes.some((a) => a.canUndo)
    const moveOn = ready(phase, capture.progress, elapsed)
    return (
        <div className="flex flex-col gap-4">
            {!joystick.writable && (
                <div className="flex items-start gap-2 rounded-[10px] border border-border bg-muted/40 p-3 text-xs">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>
                        Read-only through the dongle. Connect the joystick over
                        USB to calibrate it or change its settings.
                    </span>
                </div>
            )}
            <SettingsSection
                title="Calibration"
                description="Kept on the stick, not in the saved settings. Calibrate measures where the stick rests and how far it reaches, and suggests deadzones."
            >
                {inputs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        {lostOrEmpty(state, lost)}
                    </p>
                )}
                {inputs.map((s, i) => (
                    <InputRow
                        key={i}
                        index={i}
                        raw={s.raw}
                        value={s.value}
                        cfg={config?.axes[i]}
                    />
                ))}
                {phase !== 'idle' && (
                    <CalibrationGuide
                        phase={phase}
                        sticks={sticks}
                        progress={capture.progress}
                        pos={capture.posOf(state)}
                    />
                )}
                {note && (
                    <p className="text-xs text-muted-foreground">{note}</p>
                )}
                <DeadzoneSuggestions key={round} suggestions={suggestions} />
                {testing && phase === 'idle' && (
                    <StickTest
                        sticks={sticks}
                        config={config}
                        state={state}
                        trace={test.trace}
                        stats={test.stats}
                        onClear={test.clear}
                    />
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                    {phase === 'idle' ? (
                        <>
                            <Button
                                size="sm"
                                disabled={disabled || inputs.length === 0}
                                onClick={() => void begin()}
                            >
                                Calibrate
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={inputs.length === 0}
                                onClick={() => setTesting((t) => !t)}
                            >
                                {testing ? 'Hide test' : 'Test'}
                            </Button>
                            {canUndo && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={() => void settle('undo')}
                                >
                                    Undo calibration
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={disabled}
                                onClick={() => void settle('reset')}
                                className="ml-auto"
                            >
                                Reset to default
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                size="sm"
                                disabled={disabled || !moveOn}
                                onClick={() =>
                                    phase === 'rim' ? next() : void finish()
                                }
                            >
                                {phase === 'rim' ? 'Next' : 'Finish'}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={disabled}
                                onClick={() => void settle('cancel')}
                            >
                                Cancel
                            </Button>
                        </>
                    )}
                </div>
            </SettingsSection>
        </div>
    )
}
