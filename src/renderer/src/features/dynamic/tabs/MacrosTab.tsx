// pattern-check: skip — section spec + columns for the shared EntryTable; the step editor is the existing MacroActionRow list
import { Fragment, useMemo, useState } from 'react'
import { Circle, Plus } from 'lucide-react'

import type { KeyboardService, MacroAction } from '@firmware'
import { HidUsageLabel } from '@/features/keymap/keyboard/HidUsageLabel'
import { Button } from '@/ui/button'

import { EntryTable, type EntryColumn } from '../_shared/EntryTable'
import type { EntrySpec } from '../_shared/entryTable'
import { rawToPacked } from '../_shared/hidUsage'
import { useEntryTable } from '../_shared/useEntryTable'
import { MacroActionRow } from './macros/MacroActionRow'
import { useKeyboardRecorder } from './macros/useKeyboardRecorder'

interface Props {
    service: KeyboardService
    opened: boolean
}

type Steps = MacroAction[]
type SetSteps = (f: (p: Steps) => Steps) => void

/** Steps shown in a row before "+N more". */
const PREVIEW = 6

const Key = ({ code }: { code: number }): JSX.Element => (
    <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-md border border-border bg-secondary px-2 text-control font-semibold">
        {code ? (
            <HidUsageLabel hid_usage={rawToPacked(code)} />
        ) : (
            <span className="text-muted-foreground">none</span>
        )}
    </span>
)

const STEP: {
    readonly [K in MacroAction['kind']]: (
        a: Extract<MacroAction, { kind: K }>,
    ) => JSX.Element
} = {
    tap: (a) => <Key code={a.keycode} />,
    down: (a) => (
        <span className="flex items-center gap-1">
            <span className="text-caption text-muted-foreground">hold</span>
            <Key code={a.keycode} />
        </span>
    ),
    up: (a) => (
        <span className="flex items-center gap-1">
            <span className="text-caption text-muted-foreground">release</span>
            <Key code={a.keycode} />
        </span>
    ),
    delay: (a) => (
        <span className="text-caption text-muted-foreground">
            wait {a.ms} ms
        </span>
    ),
    text: (a) => (
        <span className="rounded-md border border-border px-2 py-1 text-control">
            “{a.text}”
        </span>
    ),
}

function Step({ action }: { action: MacroAction }): JSX.Element {
    const render = STEP[action.kind] as (a: MacroAction) => JSX.Element
    return render(action)
}

function StepsSummary({ steps }: { steps: Steps }): JSX.Element {
    if (!steps.length)
        return <span className="text-muted-foreground">No steps yet</span>
    return (
        <span className="flex flex-wrap items-center gap-1.5">
            {steps.slice(0, PREVIEW).map((a, i) => (
                <Fragment key={i}>
                    {i > 0 && (
                        <span className="text-muted-foreground" aria-hidden>
                            →
                        </span>
                    )}
                    <Step action={a} />
                </Fragment>
            ))}
            {steps.length > PREVIEW && (
                <span className="text-caption text-muted-foreground">
                    +{steps.length - PREVIEW} more
                </span>
            )}
        </span>
    )
}

const COLUMNS: readonly EntryColumn<Steps>[] = [
    {
        id: 'steps',
        header: 'What it does, in order',
        cell: (steps) => <StepsSummary steps={steps} />,
    },
    {
        id: 'length',
        header: 'Length',
        className: 'w-24',
        cell: (steps) => (
            <span className="text-caption text-muted-foreground">
                {steps.length} {steps.length === 1 ? 'step' : 'steps'}
            </span>
        ),
    },
]

/** The step editor under an open row: the existing step rows, Add and Record. */
function StepEditor({
    steps,
    set,
    editable,
}: {
    steps: Steps
    set: SetSteps
    editable: boolean
}): JSX.Element {
    const [recording, setRecording] = useState(false)
    useKeyboardRecorder(recording, editable, true, (u) =>
        set((prev) => (typeof u === 'function' ? u(prev) : u) ?? []),
    )

    const move = (i: number, delta: number): void =>
        set((p) => {
            const j = i + delta
            if (j < 0 || j >= p.length) return p
            const next = p.slice()
            const [item] = next.splice(i, 1)
            next.splice(j, 0, item!)
            return next
        })

    return (
        <div className="space-y-2">
            {steps.map((a, i) => (
                <MacroActionRow
                    key={i}
                    action={a}
                    readOnly={!editable}
                    onChange={(na) =>
                        set((p) => p.map((x, k) => (k === i ? na : x)))
                    }
                    onRemove={() => set((p) => p.filter((_, k) => k !== i))}
                    onMoveUp={() => move(i, -1)}
                    onMoveDown={() => move(i, 1)}
                />
            ))}
            {editable && (
                <div className="flex items-center gap-2 pt-1">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            set((p) => [...p, { kind: 'tap', keycode: 0 }])
                        }
                    >
                        <Plus className="size-3.5" /> Add step
                    </Button>
                    <Button
                        size="sm"
                        variant={recording ? 'destructive' : 'outline'}
                        onClick={() => setRecording((r) => !r)}
                    >
                        <Circle
                            className={`size-3 ${recording ? 'animate-pulse fill-current' : ''}`}
                        />
                        {recording ? 'Stop' : 'Record keys'}
                    </Button>
                    {recording && (
                        <span className="text-caption text-muted-foreground">
                            Press keys to capture…
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}

export function MacrosTab({ service, opened }: Props): JSX.Element | null {
    const count = service.macros?.getCount() ?? 0
    // Editable only when the adapter is not view-only AND exposes a writer. ZMK
    // (compile-time macros) exposes `macros` with `readonly: true` and no
    // `setMacro` — the table renders view-only. Never gate on a firmware name.
    const editable =
        !!service.macros &&
        !service.macros.readonly &&
        !!service.macros.setMacro

    const spec = useMemo<EntrySpec<Steps>>(
        () => ({
            noun: 'macro',
            count,
            fetch: (i) => service.macros!.getMacro(i),
            store: editable
                ? (i, steps) => service.macros!.setMacro!(i, steps)
                : undefined,
            isEmpty: (steps) => steps.length === 0,
            blank: () => [],
        }),
        [service, count, editable],
    )
    const table = useEntryTable(spec, opened)

    if (count === 0) return null

    return (
        <div className="space-y-2">
            {!editable && (
                <div className="rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                    This firmware doesn’t support editing macros from Remappr —
                    macros are defined at build time. Showing them read-only.
                </div>
            )}
            <EntryTable
                table={table}
                columns={COLUMNS}
                detailLabel={editable ? 'Edit steps' : 'Show steps'}
                detail={(steps, set) => (
                    <StepEditor steps={steps} set={set} editable={editable} />
                )}
            />
        </div>
    )
}
