// Pattern check: Dispatch Map (Tier 0) — applied — each version kind maps to
// its badge; the dialog splits into a save form, a list and a detail pane.
//
// A library entry's version history (plan §6c A, P10), shared by every surface
// that opens the Library (builder, editor, devices): save a version with a
// message, see what changed between any two versions, restore one (a new
// version, never a rewrite) or copy it to a new entry.
import { useEffect, useMemo, useState } from 'react'
import { Cloud, History } from 'lucide-react'
import { GitHubIcon as Github } from '@/components/GitHubIcon'
import { toast } from 'sonner'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Badge, type BadgeTone } from '@/ui/badge'
import { AppSelect } from '@/ui/app-select'
import type { LibraryEntry } from '@/lib/library/types'
import type { LocalVersion, VersionKind } from '@/lib/library/versionRepo'
import useHistoryStore from '@/stores/historyStore'
import useLibraryStore from '@/stores/libraryStore'
import useAuthStore from '@/stores/authStore'
import { CloudVersionDetail, CloudVersionRow } from './CloudVersions'
import { GitPanel } from './GitPanel'
import { useCloudVersions } from './useCloudVersions'
import { VersionDiff } from './VersionDiff'

const KIND: Record<VersionKind, { label: string; tone: BadgeTone }> = {
    autosave: { label: 'Autosave', tone: 'muted' },
    checkpoint: { label: 'Version', tone: 'primary' },
    github: { label: 'GitHub', tone: 'info' },
}

const CURRENT = 'current'
const PREVIOUS = 'previous'

function when(ms: number): string {
    return new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function SaveVersionForm({ localId }: { localId: string }): JSX.Element {
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)
    const save = async (): Promise<void> => {
        setBusy(true)
        try {
            await useHistoryStore.getState().checkpoint(localId, message)
            setMessage('')
            toast.success('Version saved')
        } finally {
            setBusy(false)
        }
    }
    return (
        <form
            className="flex gap-2"
            onSubmit={(e) => {
                e.preventDefault()
                void save()
            }}
        >
            <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What changed? (optional)"
                maxLength={500}
                aria-label="Version message"
            />
            <Button type="submit" disabled={busy}>
                Save version
            </Button>
        </form>
    )
}

function VersionRow({
    version,
    selected,
    onSelect,
}: {
    version: LocalVersion
    selected: boolean
    onSelect: () => void
}): JSX.Element {
    const kind = KIND[version.kind]
    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                aria-current={selected}
                className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                    selected ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
            >
                <span className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">
                        v{version.n}
                    </span>
                    <Badge tone={kind.tone} size="sm">
                        {kind.label}
                    </Badge>
                    {!!version.cloudVersion && (
                        <Cloud
                            className="size-3 text-muted-foreground"
                            aria-label="Also in the cloud"
                        />
                    )}
                    {version.gitSha && (
                        <Github
                            className="size-3 text-muted-foreground"
                            aria-label={`On GitHub as ${version.gitSha.slice(0, 7)}`}
                        />
                    )}
                    <span className="ml-auto text-muted-foreground">
                        {when(version.createdAt)}
                    </span>
                </span>
                {version.message && (
                    <span className="mt-0.5 block truncate">
                        {version.message}
                    </span>
                )}
            </button>
        </li>
    )
}

/** The source to compare the selected version against. */
function baseSource(
    base: string,
    versions: readonly LocalVersion[],
    selected: LocalVersion,
    entry: LibraryEntry,
): string | null {
    if (base === CURRENT) return entry.source
    if (base !== PREVIOUS)
        return versions.find((v) => String(v.n) === base)?.source ?? null
    const i = versions.findIndex((v) => v.n === selected.n)
    return i > 0 ? (versions[i - 1]?.source ?? null) : null
}

function VersionDetail({
    entry,
    versions,
    selected,
    onOpen,
}: {
    entry: LibraryEntry
    versions: LocalVersion[]
    selected: LocalVersion
    onOpen?: (entry: LibraryEntry) => void
}): JSX.Element {
    const [base, setBase] = useState(PREVIOUS)
    const before = baseSource(base, versions, selected, entry)
    const isCurrent = selected.source === entry.source
    const restore = async (): Promise<void> => {
        await useHistoryStore.getState().restore(entry.localId, selected.n)
        toast.success(`Restored version ${selected.n}`, {
            ...(onOpen
                ? { action: { label: 'Open', onClick: () => onOpen(entry) } }
                : {}),
        })
    }
    const copy = async (): Promise<void> => {
        const made = await useHistoryStore
            .getState()
            .copyAsNew(entry.localId, selected.n)
        if (made) toast.success(`Saved as "${made.name}"`)
    }
    return (
        <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-panel-title font-semibold">
                    Version {selected.n}
                </h3>
                <div className="ml-auto flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={isCurrent}
                        title={
                            isCurrent
                                ? 'This is the current document'
                                : undefined
                        }
                        onClick={() => void restore()}
                    >
                        Restore
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void copy()}
                    >
                        Copy as new
                    </Button>
                </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Compared with
                <AppSelect
                    value={base}
                    onChange={(e) => setBase(e.target.value)}
                    className="w-48"
                    aria-label="Compare with"
                >
                    <option value={PREVIOUS}>The version before</option>
                    <option value={CURRENT}>The current document</option>
                    {versions
                        .filter((v) => v.n !== selected.n)
                        .map((v) => (
                            <option key={v.n} value={String(v.n)}>
                                Version {v.n}
                            </option>
                        ))}
                </AppSelect>
            </label>
            {before === null ? (
                <p className="text-xs text-muted-foreground">
                    The first version: nothing before it.
                </p>
            ) : (
                <VersionDiff
                    kind={entry.kind}
                    before={before}
                    after={selected.source}
                />
            )}
        </div>
    )
}

export interface HistoryDialogProps {
    entry: LibraryEntry | null
    onClose: () => void
    /** Open the entry in its editor (after a restore). */
    onOpen?: (entry: LibraryEntry) => void
}

export function HistoryDialog({
    entry: opened,
    onClose,
    onOpen,
}: HistoryDialogProps): JSX.Element {
    const localId = opened?.localId ?? ''
    // The live entry, so a restore shows as the current document at once.
    const live = useLibraryStore((s) =>
        s.entries.find((e) => e.localId === localId),
    )
    const entry = opened ? (live ?? opened) : null
    const versions = useHistoryStore((s) => s.versions[localId])
    const accountId = useAuthStore((s) => s.user?.id ?? null)
    // The picked version, per entry (a newly opened entry starts at its
    // newest): a local version number, or a cloud one.
    const [picked, setPicked] = useState<{
        id: string
        local?: number
        cloud?: number
    } | null>(null)
    const pick = picked?.id === localId ? picked : null

    useEffect(() => {
        if (localId) void useHistoryStore.getState().load(localId)
    }, [localId])

    const newestFirst = useMemo(
        () => [...(versions ?? [])].reverse(),
        [versions],
    )
    const cloudRows = useCloudVersions(entry, versions ?? [], accountId)
    // With no local versions (another device's entry) the newest cloud one
    // starts selected.
    const firstCloud = newestFirst.length === 0 ? (cloudRows[0] ?? null) : null
    const cloudPicked =
        pick?.cloud !== undefined
            ? (cloudRows.find((v) => v.version === pick.cloud) ?? null)
            : pick?.local === undefined
              ? firstCloud
              : null
    const selected = cloudPicked
        ? null
        : (newestFirst.find((v) => v.n === pick?.local) ??
          newestFirst[0] ??
          null)
    const empty = newestFirst.length === 0 && cloudRows.length === 0

    return (
        <Modal
            opened={!!entry}
            onClose={onClose}
            size="lg"
            title={entry ? `History of "${entry.name}"` : 'History'}
            subtitle={
                entry?.sync.itemId
                    ? 'Saved versions sync with your account; autosaves stay on this machine.'
                    : 'Versions are kept on this machine.'
            }
            headerIcon={<History />}
            showFooter={false}
        >
            {entry && (
                <div className="space-y-4">
                    <SaveVersionForm localId={entry.localId} />
                    <GitPanel entry={entry} />
                    {empty ? (
                        <p className="text-sm text-muted-foreground">
                            No versions yet. Edits are saved as versions a
                            moment after you stop, or save one now.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-4 md:flex-row">
                            <div className="max-h-[50vh] shrink-0 space-y-3 overflow-y-auto md:w-64">
                                <ul className="space-y-0.5">
                                    {newestFirst.map((v) => (
                                        <VersionRow
                                            key={v.n}
                                            version={v}
                                            selected={v.n === selected?.n}
                                            onSelect={() =>
                                                setPicked({
                                                    id: localId,
                                                    local: v.n,
                                                })
                                            }
                                        />
                                    ))}
                                </ul>
                                {cloudRows.length > 0 && (
                                    <section>
                                        <h4 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Only in the cloud
                                        </h4>
                                        <ul className="space-y-0.5">
                                            {cloudRows.map((v) => (
                                                <CloudVersionRow
                                                    key={v.version}
                                                    version={v}
                                                    selected={
                                                        v.version ===
                                                        cloudPicked?.version
                                                    }
                                                    onSelect={() =>
                                                        setPicked({
                                                            id: localId,
                                                            cloud: v.version,
                                                        })
                                                    }
                                                />
                                            ))}
                                        </ul>
                                    </section>
                                )}
                            </div>
                            {cloudPicked && (
                                <CloudVersionDetail
                                    key={`c${cloudPicked.version}`}
                                    entry={entry}
                                    version={cloudPicked}
                                    accountId={accountId}
                                    onOpen={onOpen}
                                />
                            )}
                            {selected && (
                                <VersionDetail
                                    key={selected.n}
                                    entry={entry}
                                    versions={versions ?? []}
                                    selected={selected}
                                    onOpen={onOpen}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}
