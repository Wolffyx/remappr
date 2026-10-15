// Pattern check: no GoF pattern (-) — rejected — leaf view over service.joystick (calibration steps + live readout), mirroring MouseLiveSection.
//
// The joystick settings the device stage does not show: calibration. It
// belongs to the stick, not to a saved config, so it applies at once and a
// save never replaces it. Begin, move the stick to every edge, let it go, set
// the centre, finish. The live readout polls the joystick while the panel is
// open.
import { JSX, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type {
    AxisConfig,
    AxisState,
    DeadzoneSuggestion,
    JoystickApi,
    JoystickCalStep,
} from '@firmware/service'

import { Button } from '@/ui/button'

import { DeadzoneSuggestions } from './DeadzoneSuggestions'
import { SettingsSection } from './SettingRows'

const POLL_MS = 100
/** Failed reads in a row before the readout gives up. One is a busy moment (a
 *  calibration step writing flash); a run of them is a stick gone away. */
const MAX_FAILED_READS = 5
const AXIS_NAMES = ['X', 'Y', 'Z', 'Rx', 'Ry', 'Rz']

type Phase = 'idle' | 'sweeping' | 'centred'

const message = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

/** What each step needs to have happened first, for the error a refused step
 *  gets. */
const REFUSED: Readonly<Partial<Record<JoystickCalStep, string>>> = {
    centre: 'Begin first.',
    finish: 'Move the stick to every edge, let it go and set the centre first.',
}

/** What a step that went through means, shown under the readout. */
const STEP_NOTE: Readonly<Record<JoystickCalStep, string>> = {
    begin: 'Move the stick to every edge a few times, holding it there a moment. Then let it go and set the centre.',
    centre: 'Centre set. Flick the stick and let it go two or three times, then Finish.',
    finish: 'Calibration saved on the stick.',
    cancel: 'Cancelled. The stick keeps its previous calibration.',
    reset: 'Calibration reset to the default.',
}

const NEXT_PHASE: Readonly<Record<JoystickCalStep, Phase>> = {
    begin: 'sweeping',
    centre: 'centred',
    finish: 'idle',
    cancel: 'idle',
    reset: 'idle',
}

/** What stands in for the input rows while there are none. */
function lostOrEmpty(state: AxisState | null, lost: boolean): string {
    if (lost)
        return 'Could not read the joystick. Close this dialog and reconnect it.'
    if (!state) return 'Reading…'
    return 'This joystick has no analog inputs.'
}

/** Where `v` sits between `lo` and `hi`, 0..100. */
const pct = (v: number, lo: number, hi: number): number =>
    hi > lo ? Math.min(100, Math.max(0, ((v - lo) * 100) / (hi - lo))) : 50

function useLiveState(api: JoystickApi): {
    state: AxisState | null
    lost: boolean
} {
    const [state, setState] = useState<AxisState | null>(null)
    const [lost, setLost] = useState(false)
    useEffect(() => {
        let busy = false
        let failed = 0
        const id = setInterval(() => {
            if (busy) return
            busy = true
            api.getState()
                .then((s) => {
                    failed = 0
                    setState(s)
                })
                .catch((e: unknown) => {
                    failed += 1
                    if (failed < MAX_FAILED_READS) return
                    clearInterval(id)
                    setLost(true)
                    toast.error('Failed to read the joystick', {
                        description: message(e),
                    })
                })
                .finally(() => {
                    busy = false
                })
        }, POLL_MS)
        return () => clearInterval(id)
    }, [api])
    return { state, lost }
}

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
            <span className="w-36 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {cfg ? `${cfg.min}…${cfg.centre}…${cfg.max}` : ''}
            </span>
        </div>
    )
}

export function JoystickSettingsPanel({
    joystick,
}: {
    joystick: JoystickApi
}): JSX.Element {
    const { state, lost } = useLiveState(joystick)
    const [config, setConfig] = useState<AxisConfig | null>(null)
    const [phase, setPhase] = useState<Phase>('idle')
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState<string | null>(null)
    const [suggestions, setSuggestions] = useState<
        readonly DeadzoneSuggestion[]
    >([])
    // A new calibration's suggestions start un-applied.
    const [round, setRound] = useState(0)

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

    const step = async (s: JoystickCalStep): Promise<void> => {
        setBusy(true)
        try {
            const measured = await joystick.calibrate(s)
            if (s === 'finish' || s === 'begin') {
                setSuggestions(measured)
                setRound((r) => r + 1)
            }
            setPhase(NEXT_PHASE[s])
            setNote(STEP_NOTE[s])
            if (s === 'finish' || s === 'reset') {
                await readConfig()
                toast.success(STEP_NOTE[s])
            }
        } catch (e) {
            toast.error('Calibration step refused', {
                description: REFUSED[s] ?? message(e),
            })
        }
        setBusy(false)
    }

    const disabled = busy || !joystick.writable
    const inputs = state?.inputs ?? []
    return (
        <div className="flex flex-col gap-4">
            <SettingsSection
                title="Calibration"
                description="Kept on the stick, not in the saved settings. Begin, move the stick to every edge, let it go, set the centre, then finish."
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
                {note && (
                    <p className="text-xs text-muted-foreground">{note}</p>
                )}
                <DeadzoneSuggestions key={round} suggestions={suggestions} />
                <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                        size="sm"
                        disabled={disabled || inputs.length === 0}
                        onClick={() => void step('begin')}
                    >
                        {phase === 'idle' ? 'Begin' : 'Start over'}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={disabled || phase === 'idle'}
                        onClick={() => void step('centre')}
                    >
                        Set centre
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={disabled || phase !== 'centred'}
                        onClick={() => void step('finish')}
                    >
                        Finish
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={disabled || phase === 'idle'}
                        onClick={() => void step('cancel')}
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={disabled || phase !== 'idle'}
                        onClick={() => void step('reset')}
                        className="ml-auto"
                    >
                        Reset to default
                    </Button>
                </div>
            </SettingsSection>
        </div>
    )
}
