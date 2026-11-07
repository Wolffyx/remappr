// Pattern check: Dispatch Map (Tier 0) — applied — each sync state maps to its
// badge and note; the panel splits into a link form, a status bar and the
// conflict / hand-edit choices.
//
// GitHub sync of one library entry (plan §6c A2, P10f), inside its History:
// link it to owner/repo + branch + folder, see where it stands, sync now, and
// settle a conflict or generated files edited on GitHub.
import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, RefreshCw, Unlink } from 'lucide-react'
import { GitHubIcon as Github } from '@/components/GitHubIcon'
import { GitReleases } from './GitReleases'
import { toast } from 'sonner'
import {
    parseKeymap,
    resolveAllowedTargets,
    targetLabel,
} from '@firmware/config'
import { createLogger } from '@shared/logger'
import { Badge, type BadgeTone } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { AppSelect } from '@/ui/app-select'
import { SwitchRow } from '@/ui/switch-row'
import { githubAppConfig, installUrl } from '@/lib/github/appAuth'
import { getGithubToken } from '@/lib/github/connection'
import { slugOf, sourcePath } from '@/lib/github/gitSync/layout'
import { createRepoApi, type RepoInfo } from '@/lib/github/repoApi'
import type { GitLink, GitSyncState, LibraryEntry } from '@/lib/library/types'
import useGithubStore from '@/stores/githubStore'
import useGitSyncStore, { syncErrorText } from '@/stores/gitSyncStore'

const log = createLogger('GitPanel')

const STATE: Record<
    GitSyncState,
    { label: string; tone: BadgeTone; note?: string }
> = {
    synced: { label: 'Up to date', tone: 'success' },
    ahead: {
        label: 'Not on GitHub yet',
        tone: 'muted',
        note: 'Edits since the last sync. Saved versions go up on their own when auto push is on; Sync now sends the rest.',
    },
    pushing: { label: 'Syncing…', tone: 'info' },
    offline: {
        label: 'Offline',
        tone: 'warning',
        note: 'Saved versions wait on this machine and go to GitHub when you are back online.',
    },
    conflict: { label: 'Conflict', tone: 'danger' },
    hand_edited: { label: 'Files edited on GitHub', tone: 'warning' },
    error: { label: 'Failed', tone: 'danger' },
}

const run = (task: Promise<unknown>): void => {
    task.catch((e: unknown) => toast.error(syncErrorText(e)))
}

/** The target a keymap names for itself, else none. */
function defaultTarget(entry: LibraryEntry): string | null {
    if (entry.kind !== 'remappr.keymap') return null
    try {
        return parseKeymap(entry.source).meta?.target ?? null
    } catch {
        return null
    }
}

function TargetSelect({
    entry,
    value,
    onChange,
}: {
    entry: LibraryEntry
    value: string | null
    onChange: (target: string | null) => void
}): JSX.Element | null {
    // Generated firmware files only exist for keymaps.
    if (entry.kind !== 'remappr.keymap') return null
    return (
        <div className="space-y-1 text-xs font-semibold">
            <span className="block">Firmware files</span>
            <AppSelect
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value || null)}
                aria-label="Firmware files to generate"
            >
                <option value="">None: the Remappr file only</option>
                {resolveAllowedTargets(null).map((t) => (
                    <option key={t} value={t}>
                        {targetLabel(t)}
                    </option>
                ))}
            </AppSelect>
        </div>
    )
}

function LinkForm({
    entry,
    onCancel,
}: {
    entry: LibraryEntry
    onCancel: () => void
}): JSX.Element {
    const link = useGitSyncStore((s) => s.link)
    const busy = useGitSyncStore((s) => !!s.busy[entry.localId])
    const [repos, setRepos] = useState<RepoInfo[] | null>(null)
    const [repo, setRepo] = useState('')
    const [branch, setBranch] = useState('')
    const [folder, setFolder] = useState('remappr')
    const [target, setTarget] = useState<string | null>(() =>
        defaultTarget(entry),
    )
    const [autoPush, setAutoPush] = useState(true)
    const app = githubAppConfig()

    const [reads, setReads] = useState(0)

    // The repos this connection reaches; read again after the user made or
    // granted one on GitHub.
    useEffect(() => {
        let live = true
        void getGithubToken()
            .then((token) => (token ? createRepoApi(token).listRepos() : []))
            .then((list) => {
                if (live) setRepos(list)
            })
            .catch((e: unknown) => {
                log.warn('could not list repos', e)
                if (live) setRepos([])
            })
        return () => {
            live = false
        }
    }, [reads])

    // GitHub's new-repo page, named after the entry. An empty repo is fine:
    // the first sync starts it.
    const newRepoUrl = `https://github.com/new?${new URLSearchParams({
        name: `${slugOf(entry.name)}-config`,
        description: `${entry.name}, kept by Remappr`,
        visibility: 'private',
    })}`

    const picked = repos?.find((r) => r.fullName === repo)
    const pick = (name: string): void => {
        setRepo(name)
        const info = repos?.find((r) => r.fullName === name)
        if (info) setBranch(info.defaultBranch)
    }

    const submit = (e: React.FormEvent): void => {
        e.preventDefault()
        run(
            link(entry.localId, {
                repo: repo.trim(),
                branch: branch.trim() || 'main',
                folder: folder.trim().replace(/^\/+|\/+$/g, '') || 'remappr',
                target,
                autoPush,
            }).then(() => toast.success(`Linked to ${repo.trim()}`)),
        )
    }

    return (
        <form className="space-y-3" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 text-xs font-semibold">
                    <span className="block">Repository</span>
                    {repos && repos.length > 0 ? (
                        <AppSelect
                            value={repo}
                            onChange={(e) => pick(e.target.value)}
                            aria-label="Repository"
                        >
                            <option value="">Choose a repository</option>
                            {repos.map((r) => (
                                <option key={r.fullName} value={r.fullName}>
                                    {r.fullName}
                                </option>
                            ))}
                        </AppSelect>
                    ) : (
                        <Input
                            value={repo}
                            onChange={(e) => setRepo(e.target.value)}
                            placeholder={repos ? 'owner/name' : 'Loading…'}
                            aria-label="Repository"
                        />
                    )}
                </div>
                <div className="space-y-1 text-xs font-semibold">
                    <span className="block">Branch</span>
                    <Input
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                        aria-label="Branch"
                    />
                </div>
                <div className="space-y-1 text-xs font-semibold">
                    <span className="block">Folder</span>
                    <Input
                        value={folder}
                        onChange={(e) => setFolder(e.target.value)}
                        aria-label="Folder"
                    />
                </div>
                <TargetSelect
                    entry={entry}
                    value={target}
                    onChange={setTarget}
                />
            </div>
            <SwitchRow
                label="Push saved versions on their own"
                hint="Each saved version becomes a commit. Off: only Sync now pushes."
                checked={autoPush}
                onChange={setAutoPush}
                boxed
            />
            {picked && !picked.canPush && (
                <p className="text-xs text-warning">
                    This connection cannot push to {picked.fullName}.
                </p>
            )}
            {repos?.length === 0 && (
                <p className="text-xs text-warning">
                    Remappr cannot reach any of your repositories yet. Install
                    the Remappr app on one, or type owner/name.
                </p>
            )}
            <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                <span>No repo for it yet?</span>
                <button
                    type="button"
                    className="underline"
                    onClick={() => window.open(newRepoUrl, '_blank')}
                >
                    Create one on GitHub
                </button>
                {app ? (
                    <>
                        <span>· Not listed?</span>
                        <button
                            type="button"
                            className="underline"
                            onClick={() =>
                                window.open(installUrl(app), '_blank')
                            }
                        >
                            Give the Remappr app access to it
                        </button>
                    </>
                ) : (
                    <span>· Not listed? Check the token can reach it.</span>
                )}
                <span>·</span>
                <button
                    type="button"
                    className="underline"
                    onClick={() => {
                        setRepos(null)
                        setReads((n) => n + 1)
                    }}
                >
                    Refresh the list
                </button>
            </p>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={busy || !/^[^/\s]+\/[^/\s]+$/.test(repo.trim())}
                >
                    <Github className="size-4" /> Link and push
                </Button>
            </div>
        </form>
    )
}

function ConflictChoices({ localId }: { localId: string }): JSX.Element {
    const resolve = useGitSyncStore((s) => s.resolveConflict)
    const busy = useGitSyncStore((s) => !!s.busy[localId])
    return (
        <div className="space-y-2 rounded-lg border border-danger/40 p-3 text-xs">
            <p>
                This changed here and on GitHub since the last sync. Which one
                stays? GitHub keeps both in its history either way.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => run(resolve(localId, 'mine'))}
                >
                    Keep this one
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(resolve(localId, 'theirs'))}
                >
                    Take GitHub&apos;s
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(resolve(localId, 'both'))}
                >
                    Keep both
                </Button>
            </div>
        </div>
    )
}

function HandEditChoices({
    link,
    localId,
}: {
    link: GitLink
    localId: string
}): JSX.Element {
    const resolve = useGitSyncStore((s) => s.resolveHandEdits)
    const busy = useGitSyncStore((s) => !!s.busy[localId])
    const files = link.handEdited ?? []
    return (
        <div className="space-y-2 rounded-lg border border-warning/40 p-3 text-xs">
            <p>
                Remappr makes these files from the Remappr file, and they were
                edited on GitHub:
            </p>
            <ul className="list-inside list-disc font-mono">
                {files.map((f) => (
                    <li key={f}>{f}</li>
                ))}
            </ul>
            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => run(resolve(localId, 'overwrite'))}
                >
                    Make them again
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(resolve(localId, 'keep'))}
                >
                    Keep the edits (stop making them)
                </Button>
            </div>
        </div>
    )
}

function Linked({
    entry,
    link,
}: {
    entry: LibraryEntry
    link: GitLink
}): JSX.Element {
    const busy = useGitSyncStore((s) => !!s.busy[entry.localId])
    const syncNow = useGitSyncStore((s) => s.syncNow)
    const unlink = useGitSyncStore((s) => s.unlink)
    const configure = useGitSyncStore((s) => s.configure)
    const state = STATE[busy ? 'pushing' : (link.state ?? 'ahead')]
    const path = sourcePath(link)
    const fileUrl = `https://github.com/${link.repo}/blob/${encodeURIComponent(link.branch)}/${path}`

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={state.tone} size="sm">
                    {state.label}
                </Badge>
                <button
                    type="button"
                    className="inline-flex min-w-0 items-center gap-1 truncate font-mono hover:underline"
                    onClick={() => window.open(fileUrl, '_blank')}
                    title="Open on GitHub"
                >
                    {link.repo}@{link.branch}:{path}
                    <ExternalLink className="size-3 shrink-0" />
                </button>
                <span className="ml-auto flex gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => run(syncNow(entry.localId))}
                    >
                        <RefreshCw
                            className={`size-3.5 ${busy ? 'animate-spin' : ''}`}
                        />{' '}
                        Sync now
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                            run(
                                unlink(entry.localId).then(() =>
                                    toast.success(
                                        'Unlinked from GitHub; the repo keeps its files.',
                                    ),
                                ),
                            )
                        }
                    >
                        <Unlink className="size-3.5" /> Unlink
                    </Button>
                </span>
            </div>
            {state.note && !busy && (
                <p className="text-xs text-muted-foreground">{state.note}</p>
            )}
            {link.state === 'error' && link.error && (
                <p className="text-xs text-danger">{link.error}</p>
            )}
            {link.state === 'conflict' && (
                <ConflictChoices localId={entry.localId} />
            )}
            {link.state === 'hand_edited' && (
                <HandEditChoices link={link} localId={entry.localId} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
                <SwitchRow
                    label="Push saved versions on their own"
                    checked={link.autoPush}
                    onChange={(autoPush) =>
                        run(configure(entry.localId, { autoPush }))
                    }
                    boxed
                />
                <TargetSelect
                    entry={entry}
                    value={link.target}
                    onChange={(target) =>
                        run(configure(entry.localId, { target }))
                    }
                />
            </div>
            <GitReleases entry={entry} link={link} />
        </div>
    )
}

export function GitPanel({ entry }: { entry: LibraryEntry }): JSX.Element {
    const connected = useGithubStore((s) => s.status === 'connected')
    const pull = useGitSyncStore((s) => s.pull)
    const [linking, setLinking] = useState(false)
    const link = entry.git
    const linkedId = link ? entry.localId : null

    useEffect(() => {
        void useGithubStore.getState().init()
    }, [])

    // Opening the History of a linked entry checks GitHub for news.
    useEffect(() => {
        if (linkedId && connected) void pull(linkedId).catch(() => undefined)
    }, [linkedId, connected, pull])

    const body = useMemo(() => {
        if (link) return <Linked entry={entry} link={link} />
        if (!connected)
            return (
                <p className="text-xs text-muted-foreground">
                    Keep this in your own GitHub repo, with every saved version
                    as a commit: connect GitHub in Settings → Integrations.
                </p>
            )
        if (linking)
            return <LinkForm entry={entry} onCancel={() => setLinking(false)} />
        return (
            <div className="flex items-center gap-2">
                <p className="flex-1 text-xs text-muted-foreground">
                    Keep this in your own GitHub repo: every saved version
                    becomes a commit, and edits made on GitHub come back here.
                </p>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLinking(true)}
                >
                    <Github className="size-3.5" /> Link to GitHub
                </Button>
            </div>
        )
    }, [link, connected, linking, entry])

    return (
        <section className="space-y-2 rounded-xl border bg-background p-3">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold">
                <Github className="size-3.5" /> GitHub
            </h4>
            {body}
        </section>
    )
}
