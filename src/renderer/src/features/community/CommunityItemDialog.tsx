// Pattern check: no GoF pattern (-) — rejected — presentational dialog over the
// community repository and the library store; the macro scan is importSafety's.
//
// One community item: who made it, its license, its releases with their
// changelogs and, for keymaps, the macros it would put on a keyboard (flagging
// the ones that drive the operating system). Save copies the latest release
// into the local library; Fork copies it into the user's account.
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, GitFork, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { parseKeymap } from '@firmware/config'
import { Button } from '@/ui/button'
import { Modal } from '@/ui/modal'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import type { Release } from '@/lib/library/communityLibrary'
import { entryFromSource } from '@/lib/library/entries'
import { macroReport, type MacroReport } from '@/lib/library/importSafety'
import type {
    LibraryDocKind,
    LibraryEntry,
    LibraryItemType,
} from '@/lib/library/types'
import useAuthStore from '@/stores/authStore'
import useLibraryStore from '@/stores/libraryStore'
import useSyncStore from '@/stores/syncStore'
import { summaryFacts } from '@/features/library/entryFacts'
import { getCommunity } from './community'

/** What the dialog shows: a listed item by id, or an unlisted one by token. */
export type CommunityTarget = { itemId: string } | { token: string }

interface ItemView {
    id: string
    type: string
    name: string
    summary: string
    description: string
    license: string | null
    owner: string | null
    imageUrl: string | null
    releases: Release[]
}

async function loadView(target: CommunityTarget): Promise<ItemView | null> {
    const community = await getCommunity()
    if (!community) return null
    if ('itemId' in target) return community.item(target.itemId)
    const shared = await community.shared(target.token)
    if (!shared) return null
    return {
        ...shared,
        description: '',
        imageUrl: null,
        releases: [
            {
                releaseNo: shared.releaseNo,
                version: 0,
                changelog: '',
                license: shared.license,
                createdAt: '',
                document: shared.document,
            },
        ],
    }
}

function kindOf(document: unknown): LibraryDocKind | null {
    const kind = (document as { kind?: unknown } | null)?.kind
    return typeof kind === 'string' ? (kind as LibraryDocKind) : null
}

function macrosOf(document: unknown): MacroReport[] {
    if (kindOf(document) !== 'remappr.keymap') return []
    try {
        return macroReport(parseKeymap(JSON.stringify(document)))
    } catch {
        // A keymap that does not parse is refused on save anyway.
        return []
    }
}

/** "36 keys · 3 layers" for the latest release, or null when it does not parse. */
function factsOf(document: unknown, type: string | undefined): string | null {
    const kind = kindOf(document)
    if (!kind || !type) return null
    try {
        const entry = entryFromSource(
            kind,
            JSON.stringify(document),
            type as LibraryItemType,
        )
        return summaryFacts(entry.summary) || null
    } catch {
        // Facts are decoration; an unparsable release still lists.
        return null
    }
}

function MacroList({ macros }: { macros: MacroReport[] }): JSX.Element | null {
    if (macros.length === 0) return null
    const flagged = macros.filter((m) => m.warnings.length > 0)
    return (
        <div className="space-y-1.5">
            <div className="eyebrow">Macros ({macros.length})</div>
            {flagged.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                    {flagged.length === 1
                        ? 'One macro drives'
                        : `${flagged.length} macros drive`}{' '}
                    your computer directly. Read them before putting this on a
                    keyboard.
                </p>
            )}
            <ul className="space-y-1 text-xs">
                {macros.map((m) => (
                    <li key={m.id} className="rounded-md border px-2 py-1">
                        <span className="font-mono font-semibold">{m.id}</span>
                        <span className="text-muted-foreground">
                            {' '}
                            · {m.steps} steps
                            {m.description ? ` · ${m.description}` : ''}
                        </span>
                        {m.warnings.map((w) => (
                            <div
                                key={w}
                                className="text-amber-600 dark:text-amber-400"
                            >
                                {w}
                            </div>
                        ))}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export function CommunityItemDialog({
    target,
    onClose,
    onOpen,
}: {
    target: CommunityTarget | null
    onClose: () => void
    /** Opens a saved entry in the current surface; false when it cannot. */
    onOpen?: (entry: LibraryEntry) => Promise<boolean> | boolean
}): JSX.Element {
    const signedIn = useAuthStore((s) => s.status === 'signed_in')
    const [view, setView] = useState<ItemView | null>(null)
    const [missing, setMissing] = useState(false)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!target) return
        let live = true
        loadView(target)
            .then((v) => {
                if (!live) return
                setView(v)
                setMissing(!v)
            })
            .catch((e: unknown) => toast.error(cloudErrorMessage(e)))
        return () => {
            live = false
            setView(null)
            setMissing(false)
        }
    }, [target])

    const latest = view?.releases[0]
    const macros = useMemo(() => macrosOf(latest?.document), [latest])
    const facts = useMemo(
        () => factsOf(latest?.document, view?.type),
        [latest, view?.type],
    )

    const saveLocal = async (): Promise<LibraryEntry | null> => {
        if (!view || !latest) return null
        const kind = kindOf(latest.document)
        if (!kind)
            throw new Error('This item is not a document Remappr can open')
        const entry = await useLibraryStore
            .getState()
            .save(
                entryFromSource(
                    kind,
                    JSON.stringify(latest.document, null, 2),
                    view.type as LibraryItemType,
                ),
            )
        if (signedIn) {
            const community = await getCommunity()
            // Counting is best-effort; a failed count never blocks the save.
            await community
                ?.recordDownload(view.id)
                .catch((e: unknown) => console.warn('download not counted', e))
        }
        return entry
    }

    const run = async (task: () => Promise<void>): Promise<void> => {
        setBusy(true)
        try {
            await task()
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const save = (): Promise<void> =>
        run(async () => {
            const entry = await saveLocal()
            if (entry) toast.success(`Saved "${entry.name}" to your library`)
        })

    const open = (): Promise<void> =>
        run(async () => {
            const entry = await saveLocal()
            if (!entry || !onOpen) return
            if (!(await onOpen(entry)))
                throw new Error(`"${entry.name}" could not be opened here`)
            onClose()
        })

    const fork = (): Promise<void> =>
        run(async () => {
            const community = await getCommunity()
            if (!community || !view || !target) return
            await community.fork(
                view.id,
                'token' in target ? target.token : undefined,
            )
            await useSyncStore.getState().syncNow()
            toast.success(`Forked "${view.name}" into your account`)
        })

    return (
        <Modal
            size="md"
            opened={!!target}
            onClose={onClose}
            title={view?.name ?? (missing ? 'Not found' : 'Loading…')}
            subtitle={
                view
                    ? [view.owner && `by ${view.owner}`, view.license]
                          .filter(Boolean)
                          .join(' · ')
                    : undefined
            }
            headerIcon={<Globe />}
            footer={
                view ? (
                    <div className="flex w-full flex-wrap justify-end gap-2">
                        {signedIn && (
                            <Button
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void fork()}
                            >
                                <GitFork className="size-4" /> Fork
                            </Button>
                        )}
                        <Button
                            variant={onOpen ? 'outline' : 'default'}
                            disabled={busy}
                            onClick={() => void save()}
                        >
                            <Download className="size-4" /> Save to library
                        </Button>
                        {onOpen && (
                            <Button disabled={busy} onClick={() => void open()}>
                                Open
                            </Button>
                        )}
                    </div>
                ) : undefined
            }
            showFooter={!!view}
        >
            {missing && (
                <p className="text-sm text-muted-foreground">
                    This item is private, was removed, or the link was replaced
                    by a new one.
                </p>
            )}
            {view && (
                <div className="space-y-4">
                    {view.imageUrl && (
                        <img
                            src={view.imageUrl}
                            alt=""
                            className="max-h-56 w-full rounded-xl object-cover"
                        />
                    )}
                    {facts && (
                        <p className="text-xs text-muted-foreground">{facts}</p>
                    )}
                    {view.summary && <p className="text-sm">{view.summary}</p>}
                    {view.description && (
                        <p className="whitespace-pre-line text-sm text-muted-foreground">
                            {view.description}
                        </p>
                    )}
                    <MacroList macros={macros} />
                    {view.releases.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="eyebrow">Releases</div>
                            <ul className="space-y-1.5 text-sm">
                                {view.releases.map((r) => (
                                    <li
                                        key={r.releaseNo}
                                        className="rounded-md border px-3 py-2"
                                    >
                                        <span className="font-semibold">
                                            Release {r.releaseNo}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {r.createdAt
                                                ? ` · ${new Date(r.createdAt).toLocaleDateString()}`
                                                : ''}
                                            {r.license ? ` · ${r.license}` : ''}
                                        </span>
                                        {r.changelog && (
                                            <p className="whitespace-pre-line text-xs text-muted-foreground">
                                                {r.changelog}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}
