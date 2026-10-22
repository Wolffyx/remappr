// pattern-check: skip — form tab composing shared primitives
import { DockActions } from '@/ui/dock-shell'
import { layerAccent } from '@/lib/keymap/keyCategory'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

import type { ComboEntry, KeyboardService } from '@firmware'
import { Button } from '@/ui/button'

import { saveWithToast } from '@/lib/saveWithToast'

import { EntryCard, HexChip, Pair } from '../_shared/EntryCard'
import { IndexInput } from '../_shared/IndexInput'
import { useDynamicEntry } from '../_shared/useDynamicEntry'

interface Props {
    service: KeyboardService
    count: number
    opened: boolean
}

export function ComboTab({ service, count, opened }: Props): JSX.Element {
    const [rawIdx, setIdx] = useState(0)
    const idx = Math.min(Math.max(0, rawIdx), Math.max(0, count - 1))
    const { entry, setEntry, loading } = useDynamicEntry<ComboEntry>(
        service,
        idx,
        opened,
        (s, i) => s.dynamic?.getCombo(i),
        'combo',
    )

    const setKey = (i: 0 | 1 | 2 | 3, v: number): void => {
        if (!entry) return
        const keys: ComboEntry['keys'] = [...entry.keys]
        keys[i] = v
        setEntry({ ...entry, keys })
    }

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if (!entry || !service.dynamic) return
                await service.dynamic.setCombo(idx, entry)
            },
            `Combo #${idx} saved`,
            'Failed to save combo',
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
                    <EntryCard index={idx} accent={layerAccent(1)}>
                        <Pair label="Trigger keys">
                            <div className="flex items-center gap-1.5">
                                {entry.keys.map((k, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-1.5"
                                    >
                                        {i > 0 && (
                                            <span className="font-bold text-muted-foreground">
                                                +
                                            </span>
                                        )}
                                        <HexChip
                                            value={k}
                                            onChange={(v) =>
                                                setKey(i as 0 | 1 | 2 | 3, v)
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </Pair>
                        <ArrowRight className="mb-2 size-3.5 text-muted-foreground" />
                        <Pair label="Output">
                            <HexChip
                                value={entry.output}
                                onChange={(v) =>
                                    setEntry({ ...entry, output: v })
                                }
                            />
                        </Pair>
                    </EntryCard>
                    <DockActions>
                        <Button onClick={save} size="sm">
                            Save
                        </Button>
                    </DockActions>
                </>
            )}
        </div>
    )
}
