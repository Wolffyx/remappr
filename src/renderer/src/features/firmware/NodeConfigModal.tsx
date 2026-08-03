// Pattern check: no GoF pattern (-) — rejected — leaf view over node config; local
// form state staged as one setNode() patch on save (mirrors ConditionalLayersModal).
//
// Config-blob node editor (§N4b role / §N4c mode-A). Remappr-only (gated on
// service.limits → RemapprKeyboardService). Sets which node is the cluster
// coordinator, its input forward mode, and — for a mode-A coordinator — the cluster
// address map (hardware UID → position/encoder/pointer base). Edits local state,
// stages one setNode() patch of the changed fields, and pushes on commit().
import { useEffect, useRef, useState } from 'react'
import { Waypoints, Plus, Trash2 } from 'lucide-react'

import type { ConfigClusterNode, ConfigNode } from '@firmware/config'
import { supportsConfigEditing } from '@firmware/remappr/configEditing'

import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Input } from '@/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

import {
    ROLE_OPTIONS,
    FORWARD_MODE_OPTIONS,
    emptyClusterNode,
    clusterError,
} from './nodeFields'

interface Props {
    opened: boolean
    onClose: () => void
}

type Role = NonNullable<ConfigNode['role']>
type ForwardMode = NonNullable<ConfigNode['forwardMode']>

interface Form {
    role: Role | ''
    forwardMode: ForwardMode
    cluster: ConfigClusterNode[]
}

const sameCluster = (
    a: readonly ConfigClusterNode[],
    b: readonly ConfigClusterNode[],
): boolean => JSON.stringify(a) === JSON.stringify(b)

export function NodeConfigModal({ opened, onClose }: Props): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const remappr = supportsConfigEditing(service) ? service : null

    const [form, setForm] = useState<Form>({
        role: '',
        forwardMode: 'resolved',
        cluster: [],
    })
    const orig = useRef<ConfigNode>({})
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!opened || !remappr) return
        const node = remappr.getNode()
        orig.current = node
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm({
            role: node.role ?? '',
            forwardMode: node.forwardMode ?? 'resolved',
            cluster: (node.cluster ?? []).map((n) => ({ ...n })),
        })
    }, [opened, remappr])

    if (!remappr) return <></>

    const patchNode = (i: number, patch: Partial<ConfigClusterNode>): void =>
        setForm((f) => ({
            ...f,
            cluster: f.cluster.map((n, idx) =>
                idx === i ? { ...n, ...patch } : n,
            ),
        }))
    const addRow = (): void =>
        setForm((f) => ({ ...f, cluster: [...f.cluster, emptyClusterNode()] }))
    const removeRow = (i: number): void =>
        setForm((f) => ({
            ...f,
            cluster: f.cluster.filter((_, idx) => idx !== i),
        }))

    const error = clusterError(form.cluster)
    // Required int field (base/rows/cols); optional field clears to undefined.
    const num = (v: string): number => parseInt(v, 10) || 0
    const optNum = (v: string): number | undefined =>
        v.trim() === '' ? undefined : parseInt(v, 10) || 0

    const handleSave = async (): Promise<void> => {
        if (!service || error) return
        const o = orig.current
        const patch: Partial<ConfigNode> = {}
        if ((form.role || undefined) !== o.role)
            patch.role = form.role || undefined
        if (form.forwardMode !== (o.forwardMode ?? 'resolved'))
            patch.forwardMode = form.forwardMode
        if (!sameCluster(form.cluster, o.cluster ?? []))
            patch.cluster = form.cluster
        if (Object.keys(patch).length === 0) {
            onClose()
            return
        }
        remappr.setNode(patch)
        setSaving(true)
        const r = await saveWithToast(
            () => service.commit(),
            'Node settings saved',
            'Failed to save node settings',
        )
        setSaving(false)
        if (r !== undefined) onClose()
    }

    const roleHelp = ROLE_OPTIONS.find((o) => o.value === form.role)?.help
    const modeHelp = FORWARD_MODE_OPTIONS.find(
        (o) => o.value === form.forwardMode,
    )?.help
    const modeA = form.forwardMode === 'physical'

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Node & cluster"
            subtitle="Cluster role, input forwarding, and the mode-A position map"
            headerIcon={<Waypoints />}
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
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Cluster role</Label>
                    <Select
                        value={form.role || undefined}
                        onValueChange={(v) =>
                            setForm((f) => ({ ...f, role: v as Role }))
                        }
                    >
                        <SelectTrigger className="w-64">
                            <SelectValue placeholder="Firmware default" />
                        </SelectTrigger>
                        <SelectContent>
                            {ROLE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {roleHelp ?? 'Leave as the firmware Kconfig default.'}
                    </p>
                </div>

                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Input forwarding</Label>
                    <Select
                        value={form.forwardMode}
                        onValueChange={(v) =>
                            setForm((f) => ({
                                ...f,
                                forwardMode: v as ForwardMode,
                            }))
                        }
                    >
                        <SelectTrigger className="w-64">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {FORWARD_MODE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{modeHelp}</p>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Cluster address map</h3>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                            disabled={saving}
                        >
                            <Plus className="size-4" /> Add node
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Maps each node&apos;s hardware UID to where its keys
                        land in the whole-cluster position space — a mode-A
                        coordinator resolves forwarded positions against this
                        map.
                    </p>

                    {form.cluster.length === 0 && (
                        <p className="text-muted-foreground">
                            No cluster nodes yet.
                            {modeA &&
                                ' Mode A forwards raw positions — add each follower so the coordinator can resolve them.'}
                        </p>
                    )}

                    {form.cluster.map((n, i) => (
                        <div
                            key={i}
                            className="flex flex-col gap-2 rounded-md border p-2"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    Node {i + 1}
                                </span>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeRow(i)}
                                    disabled={saving}
                                    aria-label="Remove node"
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label className="text-xs">
                                    Hardware UID (hex)
                                </Label>
                                <Input
                                    value={n.uid}
                                    placeholder="deadbeef"
                                    onChange={(e) =>
                                        patchNode(i, {
                                            uid: e.target.value.trim(),
                                        })
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs">
                                        Position base
                                    </Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={n.positionBase}
                                        onChange={(e) =>
                                            patchNode(i, {
                                                positionBase: num(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs">Rows</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={n.rows}
                                        onChange={(e) =>
                                            patchNode(i, {
                                                rows: num(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs">Cols</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={n.cols}
                                        onChange={(e) =>
                                            patchNode(i, {
                                                cols: num(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs">
                                        Encoder base (optional)
                                    </Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={n.encoderBase ?? ''}
                                        onChange={(e) =>
                                            patchNode(i, {
                                                encoderBase: optNum(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs">
                                        Pointer base (optional)
                                    </Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={n.pointerBase ?? ''}
                                        onChange={(e) =>
                                            patchNode(i, {
                                                pointerBase: optNum(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

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
