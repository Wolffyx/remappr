// Pattern check: no GoF pattern (-) — rejected — leaf view over the autocorrect
// dictionary; edits a local array, stages the whole list on save. Same shape as
// ConditionalLayersModal.
//
// On-device autocorrect dictionary editor (§5.2-E, TBL_AUTOCORRECT). Remappr-only
// (gated on the config-editing surface, so demo mode gets the same editor). Each
// row is a {typo → correction} pair; the whole list is staged via setAutocorrect()
// and pushed on commit(). Clearing every row is a legitimate edit — it emits an
// empty table, which is how the device is told to drop its dictionary.
import { useEffect, useRef, useState } from 'react'
import { Plus, SpellCheck, Trash2 } from 'lucide-react'

import type { CanonAutocorrectEntry } from '@firmware/config'
import {
    autocorrectError,
    emptyAutocorrectEntry,
    withDefaultAutocorrect,
} from '@firmware/config'
import { supportsConfigEditing } from '@firmware/remappr/configEditing'

import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

interface Props {
    opened: boolean
    onClose: () => void
}

/** Same list, same order, same text — used to skip a pointless commit. */
const unchanged = (
    a: readonly CanonAutocorrectEntry[],
    b: readonly CanonAutocorrectEntry[],
): boolean =>
    a.length === b.length &&
    a.every((e, i) => e.typo === b[i].typo && e.correction === b[i].correction)

export function AutocorrectModal({ opened, onClose }: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const remappr = supportsConfigEditing(service) ? service : null

    const [entries, setEntries] = useState<CanonAutocorrectEntry[]>([])
    const orig = useRef<CanonAutocorrectEntry[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!opened || !remappr) return
        const dict = remappr.getAutocorrect()
        orig.current = dict
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEntries(dict.map((e) => ({ ...e })))
    }, [opened, remappr])

    if (!remappr) return <></>

    const patchRow = (i: number, patch: Partial<CanonAutocorrectEntry>): void =>
        setEntries((prev) =>
            prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
        )

    const addRow = (): void =>
        setEntries((prev) => [...prev, emptyAutocorrectEntry()])

    const removeRow = (i: number): void =>
        setEntries((prev) => prev.filter((_, idx) => idx !== i))

    const loadDefaults = (): void =>
        setEntries((prev) => withDefaultAutocorrect(prev))

    const error = autocorrectError(entries)

    const handleSave = async (): Promise<void> => {
        if (!service || error) return
        // Typos are matched case-insensitively and stored lowercase; trimming
        // here means a stray space cannot become an entry that never matches.
        const staged = entries.map((e) => ({
            typo: e.typo.trim().toLowerCase(),
            correction: e.correction.trim(),
        }))
        if (unchanged(orig.current, staged)) {
            onClose()
            return
        }
        remappr.setAutocorrect(staged)
        setSaving(true)
        const r = await saveWithToast(
            () => service.commit(),
            'Autocorrect dictionary saved',
            'Failed to save autocorrect dictionary',
        )
        setSaving(false)
        if (r !== undefined) onClose()
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Autocorrect"
            subtitle="Misspellings the keyboard fixes as you type"
            headerIcon={<SpellCheck />}
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !!error}>
                        Save
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4 p-2 text-sm">
                <p className="text-muted-foreground">
                    The keyboard watches the letters you type and, the moment
                    they end with one of these misspellings, deletes it and
                    types the correction instead. Correcting starts by itself
                    once a dictionary is saved; bind{' '}
                    <code className="text-xs">&amp;autocorrect</code> to a key
                    to switch it off again.
                </p>

                {entries.length === 0 && (
                    <p className="text-muted-foreground">
                        No entries. Add your own, or load the starter list of
                        common English typos.
                    </p>
                )}

                {entries.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Label className="w-full text-xs">Typo</Label>
                            <Label className="w-full text-xs">Becomes</Label>
                            <span className="size-9 shrink-0" />
                        </div>

                        {entries.map((e, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    className="w-full"
                                    value={e.typo}
                                    spellCheck={false}
                                    autoCapitalize="off"
                                    placeholder="teh"
                                    onChange={(ev) =>
                                        patchRow(i, { typo: ev.target.value })
                                    }
                                    disabled={saving}
                                    aria-label={`Typo ${i + 1}`}
                                />
                                <Input
                                    className="w-full"
                                    value={e.correction}
                                    spellCheck={false}
                                    placeholder="the"
                                    onChange={(ev) =>
                                        patchRow(i, {
                                            correction: ev.target.value,
                                        })
                                    }
                                    disabled={saving}
                                    aria-label={`Correction ${i + 1}`}
                                />
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeRow(i)}
                                    disabled={saving}
                                    aria-label={`Remove entry ${i + 1}`}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                            disabled={saving}
                        >
                            <Plus className="size-4" /> Add entry
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={loadDefaults}
                            disabled={saving}
                        >
                            Load starter list
                        </Button>
                    </div>
                    {error && (
                        <span className="text-xs text-destructive">
                            {error}
                        </span>
                    )}
                </div>

                <p className="text-xs text-muted-foreground">
                    A misspelling may be up to 24 characters of{' '}
                    <code>a-z 0-9 &apos; -</code>; a correction may add capitals
                    but not spaces. Corrections fire mid-word too, so avoid a
                    misspelling that is the tail of a real word —{' '}
                    <code>wich</code> would rewrite <code>sandwich</code>.
                </p>
            </div>
        </Modal>
    )
}
