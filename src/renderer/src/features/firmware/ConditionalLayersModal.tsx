// Pattern check: no GoF pattern (-) — rejected — leaf view over the conditional
// (tri-)layer list; edits a local array, stages one whole-list patch on save.
//
// Config-blob conditional (tri-)layers editor. Remappr-only (gated on
// service.limits, narrowed to RemapprKeyboardService). A tri-layer auto-activates
// `then` while every `if` layer is held. Edits a local list (add / remove /
// retarget), stages the whole list via setConditionalLayers(), pushes on commit().
import { useEffect, useRef, useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'

import type { CanonConditionalLayer } from '@firmware/config'
import { supportsConfigEditing } from '@firmware/configEditing'

import useConnectionStore from '@/stores/connectionStore'
import useKeymapStore from '@/stores/keymapStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

import {
    conditionalError,
    conditionalLayersPatch,
    emptyConditional,
    toggleIfLayer,
} from './conditionalFields'

interface Props {
    opened: boolean
    onClose: () => void
}

export function ConditionalLayersModal({
    opened,
    onClose,
}: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const configEditing = supportsConfigEditing(service) ? service : null
    // Live layer names for the if/then pickers — the keymap buffer commit() raises
    // from, so a pending rename is reflected before it is saved.
    const keymap = useKeymapStore((s) => s.keymap)
    const layerNames = keymap?.layers.map((l) => l.name) ?? []

    const [entries, setEntries] = useState<CanonConditionalLayer[]>([])
    const orig = useRef<CanonConditionalLayer[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!opened || !configEditing) return
        const cl = configEditing.getConditionalLayers()
        orig.current = cl
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEntries(
            cl.map((c) => ({
                ifLayers: [...c.ifLayers],
                thenLayer: c.thenLayer,
            })),
        )
    }, [opened, configEditing])

    if (!configEditing) return <></>

    const patchEntry = (
        i: number,
        patch: Partial<CanonConditionalLayer>,
    ): void =>
        setEntries((prev) =>
            prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
        )

    const toggleIf = (i: number, name: string): void =>
        setEntries((prev) =>
            prev.map((c, idx) =>
                idx === i
                    ? { ...c, ifLayers: toggleIfLayer(c.ifLayers, name) }
                    : c,
            ),
        )

    const addRow = (): void =>
        setEntries((prev) => [...prev, emptyConditional()])

    const removeRow = (i: number): void =>
        setEntries((prev) => prev.filter((_, idx) => idx !== i))

    const error = conditionalError(entries, layerNames)

    const handleSave = async (): Promise<void> => {
        if (!service || error) return
        const patch = conditionalLayersPatch(orig.current, entries)
        if (!patch) {
            onClose()
            return
        }
        configEditing.setConditionalLayers(patch)
        setSaving(true)
        const r = await saveWithToast(
            () => service.commit(),
            'Conditional layers saved',
            'Failed to save conditional layers',
        )
        setSaving(false)
        if (r !== undefined) onClose()
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Conditional layers"
            subtitle="Auto-activate a layer while other layers are held (tri-layer)"
            headerIcon={<Layers />}
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
                {entries.length === 0 && (
                    <p className="text-muted-foreground">
                        No conditional layers yet. Add one to auto-activate a
                        layer while a combination of others is held.
                    </p>
                )}

                {entries.map((c, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-3 rounded-lg border p-3"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Tri-layer {i + 1}</h3>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => removeRow(i)}
                                disabled={saving}
                                aria-label="Remove tri-layer"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-xs">
                                While these layers are all active
                            </Label>
                            <div className="flex flex-wrap gap-1">
                                {layerNames.map((name) => {
                                    const on = c.ifLayers.includes(name)
                                    return (
                                        <Button
                                            key={name}
                                            type="button"
                                            size="sm"
                                            variant={on ? 'default' : 'outline'}
                                            onClick={() => toggleIf(i, name)}
                                            disabled={saving}
                                        >
                                            {name}
                                        </Button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Label className="text-xs">activate</Label>
                            <Select
                                value={c.thenLayer || undefined}
                                onValueChange={(v) =>
                                    patchEntry(i, { thenLayer: v })
                                }
                            >
                                <SelectTrigger className="w-56">
                                    <SelectValue placeholder="Pick a layer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {layerNames.map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ))}

                <div className="flex items-center justify-between gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRow}
                        disabled={saving}
                    >
                        <Plus className="size-4" /> Add tri-layer
                    </Button>
                    {error && (
                        <span className="text-xs text-destructive">
                            {error}
                        </span>
                    )}
                </div>
            </div>
        </Modal>
    )
}
