// pattern-check: skip — form tab composing shared primitives
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

import type { KeyboardService, TapDanceEntry } from '@firmware'
import { Button } from '@/ui/button'

import { saveWithToast } from '@/lib/saveWithToast'

import { EntryCard, NumChip, Pair } from '../_shared/EntryCard'
import { IndexInput } from '../_shared/IndexInput'
import { KeycodeField } from '../_shared/KeycodeField'
import { useDynamicEntry } from '../_shared/useDynamicEntry'

// pattern-check: skip optional defaultIndex prop add to existing component — mechanical extension
interface Props {
    service: KeyboardService
    count: number
    opened: boolean
    defaultIndex?: number
}

// pattern-check: skip optional defaultIndex prop add to existing component — mechanical extension
export function TapDanceTab({
    service,
    count,
    opened,
    defaultIndex,
}: Props): JSX.Element {
    const [rawIdx, setIdx] = useState(defaultIndex ?? 0)
    const idx = Math.min(Math.max(0, rawIdx), Math.max(0, count - 1))
    const { entry, setEntry, loading } = useDynamicEntry<TapDanceEntry>(
        service,
        idx,
        opened,
        (s, i) => s.dynamic?.getTapDance(i),
        'tap-dance',
    )

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if (!entry || !service.dynamic) return
                await service.dynamic.setTapDance(idx, entry)
            },
            `Tap-dance #${idx} saved`,
            'Failed to save tap-dance',
        )

    return (
        <div className="space-y-4">
            <IndexInput
                label="Entry"
                value={idx}
                count={count}
                onChange={setIdx}
            />
            {loading && (
                <p className="text-xs text-muted-foreground">Loading…</p>
            )}
            {entry && (
                <>
                    <EntryCard index={idx} accentHue={286}>
                        <Pair label="Tap">
                            <KeycodeField
                                value={entry.onTap}
                                onChange={(v) =>
                                    setEntry({ ...entry, onTap: v })
                                }
                            />
                        </Pair>
                        <ArrowRight className="mb-2 size-3.5 text-muted-foreground" />
                        <Pair label="Hold">
                            <KeycodeField
                                value={entry.onHold}
                                onChange={(v) =>
                                    setEntry({ ...entry, onHold: v })
                                }
                            />
                        </Pair>
                        <Pair label="Double tap">
                            <KeycodeField
                                value={entry.onDoubleTap}
                                onChange={(v) =>
                                    setEntry({ ...entry, onDoubleTap: v })
                                }
                            />
                        </Pair>
                        <Pair label="Tap + Hold">
                            <KeycodeField
                                value={entry.onTapHold}
                                onChange={(v) =>
                                    setEntry({ ...entry, onTapHold: v })
                                }
                            />
                        </Pair>
                        <Pair label="Term">
                            <NumChip
                                value={entry.tappingTerm}
                                onChange={(v) =>
                                    setEntry({ ...entry, tappingTerm: v })
                                }
                            />
                            <span className="text-[11px] text-muted-foreground">
                                ms
                            </span>
                        </Pair>
                    </EntryCard>
                    <Button onClick={save} size="sm">
                        Save
                    </Button>
                </>
            )}
        </div>
    )
}
