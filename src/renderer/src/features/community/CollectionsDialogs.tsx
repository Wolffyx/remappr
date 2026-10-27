// Pattern check: no GoF pattern (-) — rejected — presentational dialogs over
// CollectionLibrary; the server checks quotas and what a viewer may see.
//
// Collections: curated lists of community items (and your own). "Add to
// collection" from an item page, the members of a collection (members the
// viewer cannot see are not listed), and the user's own collections with
// create, remove a member and publish.
import { useCallback, useEffect, useState } from 'react'
import { FolderPlus, Globe, Library, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Modal } from '@/ui/modal'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import type {
    Collection,
    CollectionMember,
} from '@/lib/library/collectionLibrary'
import { getCollectionMembers, getCollections } from './community'
import { PublishDialog, type CloudOnlyItem } from './PublishDialog'

async function fetchMine(): Promise<Collection[]> {
    const lib = await getCollections()
    return lib ? lib.mine() : []
}

function useMyCollections(open: boolean): {
    collections: Collection[]
    reload: () => Promise<void>
} {
    const [collections, setCollections] = useState<Collection[]>([])
    const reload = useCallback(
        (): Promise<void> => fetchMine().then(setCollections),
        [],
    )
    useEffect(() => {
        if (!open) return
        let live = true
        fetchMine()
            .then((c) => {
                if (live) setCollections(c)
            })
            .catch((e: unknown) => toast.error(cloudErrorMessage(e)))
        return () => {
            live = false
        }
    }, [open])
    return { collections, reload }
}

function NewCollection({
    onCreated,
}: {
    onCreated: () => Promise<void>
}): JSX.Element {
    const [name, setName] = useState('')
    const create = async (): Promise<void> => {
        try {
            const lib = await getCollections()
            await lib?.create(name.trim())
            setName('')
            await onCreated()
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        }
    }
    return (
        <div className="flex gap-2">
            <Input
                aria-label="New collection name"
                placeholder="New collection"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
            />
            <Button
                variant="outline"
                disabled={!name.trim()}
                onClick={() => void create()}
            >
                <Plus className="size-4" /> Create
            </Button>
        </div>
    )
}

export function AddToCollectionDialog({
    item,
    onClose,
}: {
    item: { id: string; name: string } | null
    onClose: () => void
}): JSX.Element {
    const { collections, reload } = useMyCollections(!!item)
    const add = async (c: Collection): Promise<void> => {
        if (!item) return
        try {
            const lib = await getCollections()
            await lib?.add(c, item.id, '')
            toast.success(`Added "${item.name}" to "${c.name}"`)
            onClose()
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        }
    }
    return (
        <Modal
            size="sm"
            opened={!!item}
            onClose={onClose}
            title="Add to collection"
            headerIcon={<FolderPlus />}
            showFooter={false}
        >
            <div className="space-y-3">
                <ul className="space-y-1.5">
                    {collections.map((c) => {
                        const inIt =
                            !!item && c.items.some((m) => m.id === item.id)
                        return (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    disabled={inIt}
                                    onClick={() => void add(c)}
                                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:border-primary/50 disabled:opacity-60"
                                >
                                    <span className="truncate font-semibold">
                                        {c.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {inIt
                                            ? 'Already in it'
                                            : `${c.items.length} items`}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
                <NewCollection onCreated={reload} />
            </div>
        </Modal>
    )
}

/** The members of a collection the viewer can see; click one to open it. */
export function CollectionMembers({
    collectionId,
    onOpen,
    onRemove,
}: {
    collectionId: string
    onOpen: (itemId: string) => void
    onRemove?: (itemId: string) => Promise<void>
}): JSX.Element {
    const [members, setMembers] = useState<CollectionMember[] | null>(null)
    const load = useCallback(
        (): Promise<void> =>
            getCollectionMembers(collectionId).then(setMembers),
        [collectionId],
    )
    useEffect(() => {
        let live = true
        getCollectionMembers(collectionId)
            .then((m) => {
                if (live) setMembers(m)
            })
            .catch((e: unknown) => toast.error(cloudErrorMessage(e)))
        return () => {
            live = false
        }
    }, [collectionId])

    if (!members)
        return <p className="text-xs text-muted-foreground">Loading…</p>
    if (members.length === 0)
        return (
            <p className="text-sm text-muted-foreground">
                Nothing in this collection yet.
            </p>
        )
    return (
        <ul className="space-y-1.5">
            {members.map((m) => (
                <li
                    key={m.itemId}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                    <button
                        type="button"
                        onClick={() => onOpen(m.itemId)}
                        className="min-w-0 flex-1 text-left"
                    >
                        <span className="block truncate text-sm font-semibold">
                            {m.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                            {[
                                m.type === 'device' ? 'Board' : 'Config',
                                m.owner && `by ${m.owner}`,
                                m.note,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </button>
                    {onRemove && (
                        <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Remove ${m.name}`}
                            onClick={() => void onRemove(m.itemId).then(load)}
                        >
                            <X className="size-4" />
                        </Button>
                    )}
                </li>
            ))}
        </ul>
    )
}

export function MyCollectionsDialog({
    open,
    onClose,
    onOpenItem,
}: {
    open: boolean
    onClose: () => void
    onOpenItem: (itemId: string) => void
}): JSX.Element {
    const { collections, reload } = useMyCollections(open)
    const [selected, setSelected] = useState<string | null>(null)
    const [publishing, setPublishing] = useState<CloudOnlyItem | null>(null)
    const current = collections.find((c) => c.id === selected) ?? null

    const remove = async (itemId: string): Promise<void> => {
        if (!current) return
        try {
            const lib = await getCollections()
            await lib?.remove(current, itemId)
            await reload()
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        }
    }

    return (
        <Modal
            size="sm"
            opened={open}
            onClose={onClose}
            onBack={current ? () => setSelected(null) : undefined}
            title={current?.name ?? 'My collections'}
            subtitle={
                current
                    ? current.visibility
                    : 'Curated lists of boards and configs'
            }
            headerIcon={<Library />}
            showFooter={false}
        >
            {current ? (
                <div className="space-y-3">
                    <CollectionMembers
                        key={current.headVersion}
                        collectionId={current.id}
                        onOpen={onOpenItem}
                        onRemove={remove}
                    />
                    <Button
                        variant="outline"
                        onClick={() =>
                            setPublishing({
                                itemId: current.id,
                                name: current.name,
                            })
                        }
                    >
                        <Globe className="size-4" /> Publish or share
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {collections.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No collections yet. Create one, then add items from
                            their pages.
                        </p>
                    )}
                    <ul className="space-y-1.5">
                        {collections.map((c) => (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelected(c.id)}
                                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:border-primary/50"
                                >
                                    <span className="truncate font-semibold">
                                        {c.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {c.items.length} items · {c.visibility}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <NewCollection onCreated={reload} />
                </div>
            )}
            <PublishDialog
                item={publishing}
                onClose={() => {
                    setPublishing(null)
                    void reload()
                }}
            />
        </Modal>
    )
}
