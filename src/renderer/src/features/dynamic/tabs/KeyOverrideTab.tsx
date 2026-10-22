// pattern-check: skip — form tab composing shared primitives
import { DockActions } from '@/ui/dock-shell'
import { layerAccent } from '@/lib/keymap/keyCategory'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

import type {
    KeyboardService,
    KeyOverrideEntry,
    KeyOverrideOptions,
} from '@firmware'
import { Button } from '@/ui/button'

import { saveWithToast } from '@/lib/saveWithToast'

import { EntryCard, HexChip, Pair } from '../_shared/EntryCard'
import { IndexInput } from '../_shared/IndexInput'
import { type OptionDef, OptionGrid } from '../_shared/OptionGrid'
import { useDynamicEntry } from '../_shared/useDynamicEntry'

interface Props {
    service: KeyboardService
    count: number
    opened: boolean
}

const KEY_OVERRIDE_OPTIONS: ReadonlyArray<OptionDef<keyof KeyOverrideOptions>> =
    [
        { key: 'enabled', label: 'Enabled' },
        { key: 'activationTriggerDown', label: 'Activate on trigger down' },
        { key: 'activationRequiredModDown', label: 'Required mod down' },
        { key: 'activationNegativeModUp', label: 'Negative mod up' },
        { key: 'oneMod', label: 'One mod' },
        { key: 'noReregisterTrigger', label: 'No re-register' },
        { key: 'noUnregisterOnOtherKeyDown', label: 'No unregister on other' },
    ]

export function KeyOverrideTab({ service, count, opened }: Props): JSX.Element {
    const [rawIdx, setIdx] = useState(0)
    const idx = Math.min(Math.max(0, rawIdx), Math.max(0, count - 1))
    const { entry, setEntry, loading } = useDynamicEntry<KeyOverrideEntry>(
        service,
        idx,
        opened,
        (s, i) => s.dynamic?.getKeyOverride(i),
        'key-override',
    )

    const setOpt = (k: keyof KeyOverrideOptions, v: boolean): void => {
        if (!entry) return
        setEntry({ ...entry, options: { ...entry.options, [k]: v } })
    }

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if (!entry || !service.dynamic) return
                await service.dynamic.setKeyOverride(idx, entry)
            },
            `Key-override #${idx} saved`,
            'Failed to save key-override',
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
                    <EntryCard index={idx} accent={layerAccent(2)}>
                        <Pair label="Trigger">
                            <HexChip
                                value={entry.trigger}
                                onChange={(v) =>
                                    setEntry({ ...entry, trigger: v })
                                }
                            />
                        </Pair>
                        <Pair label="With mods">
                            <HexChip
                                value={entry.triggerMods}
                                mask={0xff}
                                onChange={(v) =>
                                    setEntry({ ...entry, triggerMods: v })
                                }
                            />
                        </Pair>
                        <ArrowRight className="mb-2 size-3.5 text-muted-foreground" />
                        <Pair label="Replace with">
                            <HexChip
                                value={entry.replacement}
                                onChange={(v) =>
                                    setEntry({ ...entry, replacement: v })
                                }
                            />
                        </Pair>
                    </EntryCard>

                    <EntryCard index={idx} accent={layerAccent(2)}>
                        <Pair label="Layer mask">
                            <HexChip
                                value={entry.layers}
                                onChange={(v) =>
                                    setEntry({ ...entry, layers: v })
                                }
                            />
                        </Pair>
                        <Pair label="Negative mods">
                            <HexChip
                                value={entry.negativeModMask}
                                mask={0xff}
                                onChange={(v) =>
                                    setEntry({ ...entry, negativeModMask: v })
                                }
                            />
                        </Pair>
                        <Pair label="Suppressed mods">
                            <HexChip
                                value={entry.suppressedMods}
                                mask={0xff}
                                onChange={(v) =>
                                    setEntry({ ...entry, suppressedMods: v })
                                }
                            />
                        </Pair>
                    </EntryCard>

                    <OptionGrid
                        options={KEY_OVERRIDE_OPTIONS}
                        value={entry.options}
                        onChange={setOpt}
                    />
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
