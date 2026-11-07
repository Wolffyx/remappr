// Pattern check: no GoF pattern (-) — rejected — a presentational section
// (latest release, its firmware, the release form) bound to gitSyncStore.
//
// "Release to GitHub" for a linked entry (plan §6c A2, P10g): tag the synced
// commit v<semver> with notes; the repo's workflow builds the firmware for
// the tag and attaches it to the Release, shown here once it is there.
import { useCallback, useEffect, useState } from 'react'
import { Download, ExternalLink, RefreshCw, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { createLogger } from '@shared/logger'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import type { ReleaseDraft } from '@/lib/github/gitSync/engine'
import { isVersion, tagOf } from '@/lib/github/gitSync/release'
import type { GitLink, LibraryEntry } from '@/lib/library/types'
import useGitSyncStore, { syncErrorText } from '@/stores/gitSyncStore'

const log = createLogger('GitReleases')
/** How long a release without files may still be building. */
const BUILDING_FOR_MS = 60 * 60_000

const FIRMWARE_NOTE: Record<'manual' | 'none', string> = {
    manual: 'The repo’s workflow was edited by hand, so Remappr left it alone: add a step that attaches the firmware to releases, or the release has the Remappr file only.',
    none: 'This repo has no firmware workflow (choose firmware files above), so the release has the Remappr file only.',
}

const open = (url: string): void => {
    window.open(url, '_blank')
}

function ReleaseForm({
    entry,
    draft,
    onDone,
}: {
    entry: LibraryEntry
    draft: ReleaseDraft
    onDone: () => void
}): JSX.Element {
    const release = useGitSyncStore((s) => s.release)
    const busy = useGitSyncStore((s) => !!s.busy[entry.localId])
    const [version, setVersion] = useState(draft.version)
    const [notes, setNotes] = useState(draft.notes)
    const taken = draft.releases.some((r) => r.tag === tagOf(version))
    const valid = isVersion(version) && !taken

    const submit = (e: React.FormEvent): void => {
        e.preventDefault()
        release(entry.localId, version.trim(), notes.trim())
            .then((made) => {
                if (made.firmware === 'attached')
                    toast.success(`Released ${made.tag}`, {
                        description:
                            'GitHub is building the firmware; it shows up here when it is attached.',
                        action: {
                            label: 'Open',
                            onClick: () => open(made.url),
                        },
                    })
                else
                    toast.warning(`Released ${made.tag}`, {
                        description: FIRMWARE_NOTE[made.firmware],
                        duration: 12000,
                    })
                onDone()
            })
            .catch((err: unknown) => toast.error(syncErrorText(err)))
    }

    return (
        <form className="space-y-2" onSubmit={submit}>
            <div className="flex items-start gap-2">
                <div className="w-32 space-y-1 text-xs font-semibold">
                    <span className="block">Version</span>
                    <Input
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        aria-label="Version"
                        placeholder="1.0.0"
                    />
                </div>
                <p className="flex-1 pt-6 text-xs text-muted-foreground">
                    {taken
                        ? `${tagOf(version)} is already released.`
                        : isVersion(version)
                          ? `Tags the synced commit ${tagOf(version)}.`
                          : 'A version like 1.2.0.'}
                </p>
            </div>
            <div className="space-y-1 text-xs font-semibold">
                <span className="block">Notes</span>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    aria-label="Release notes"
                    rows={4}
                    placeholder="What changed in this release"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs font-normal"
                />
            </div>
            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDone}
                >
                    Cancel
                </Button>
                <Button type="submit" size="sm" disabled={busy || !valid}>
                    <Tag className="size-3.5" /> Release{' '}
                    {isVersion(version) ? tagOf(version) : ''}
                </Button>
            </div>
        </form>
    )
}

export function GitReleases({
    entry,
    link,
}: {
    entry: LibraryEntry
    link: GitLink
}): JSX.Element {
    const releaseDraft = useGitSyncStore((s) => s.releaseDraft)
    const busy = useGitSyncStore((s) => !!s.busy[entry.localId])
    const [draft, setDraft] = useState<ReleaseDraft | null>(null)
    const [loading, setLoading] = useState(true)
    const [checkedAt, setCheckedAt] = useState(0)
    const [writing, setWriting] = useState(false)
    const localId = entry.localId

    const fetchDraft = useCallback(
        (): Promise<void> =>
            releaseDraft(localId)
                .then((d) => {
                    setDraft(d)
                    setCheckedAt(Date.now())
                })
                .catch((e: unknown) => log.warn('could not read releases', e))
                .finally(() => setLoading(false)),
        [releaseDraft, localId],
    )

    useEffect(() => {
        void fetchDraft()
    }, [fetchDraft])

    const load = (): void => {
        setLoading(true)
        void fetchDraft()
    }

    const latest = draft?.releases[0]
    const mine = link.lastRelease
    const noFiles = !!latest && latest.assets.length === 0
    const build = draft?.build
    // Just released here, and Actions has not picked the tag up yet.
    const starting =
        noFiles &&
        build?.state === 'none' &&
        mine?.tag === latest.tag &&
        mine.firmware === 'attached' &&
        checkedAt - mine.at < BUILDING_FOR_MS
    const buildNote = !noFiles
        ? null
        : build?.state === 'running' || starting
          ? `GitHub is building the firmware for ${latest.tag}; check again in a few minutes.`
          : build?.state === 'failure'
            ? `The firmware build for ${latest.tag} failed, so nothing is attached.`
            : build?.state === 'success'
              ? `${latest.tag} built, but no firmware was attached: the workflow has no release step.`
              : null

    return (
        <div className="space-y-2 rounded-lg border px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
                <Tag className="size-3.5" />
                <span className="font-semibold">Releases</span>
                {latest ? (
                    <button
                        type="button"
                        className="inline-flex items-center gap-1 font-mono hover:underline"
                        onClick={() => open(latest.url)}
                    >
                        {latest.tag}
                        <ExternalLink className="size-3" />
                    </button>
                ) : (
                    <span className="text-muted-foreground">
                        {loading ? 'Reading…' : 'None yet'}
                    </span>
                )}
                <span className="ml-auto flex gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={loading}
                        onClick={load}
                        aria-label="Check releases again"
                    >
                        <RefreshCw
                            className={`size-3.5 ${loading ? 'animate-spin' : ''}`}
                        />
                    </Button>
                    {!writing && (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={
                                !draft ||
                                busy ||
                                loading ||
                                link.state === 'conflict' ||
                                link.state === 'hand_edited'
                            }
                            onClick={() => {
                                // Draft from what is on GitHub now: a push
                                // since the panel opened belongs in the notes.
                                setLoading(true)
                                void fetchDraft().then(() => setWriting(true))
                            }}
                        >
                            Release…
                        </Button>
                    )}
                </span>
            </div>
            {latest && latest.assets.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {latest.assets.map((a) => (
                        <li key={a.name}>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => open(a.url)}
                            >
                                <Download className="size-3.5" /> {a.name}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
            {buildNote && (
                <p
                    className={`flex items-center gap-2 text-xs ${
                        build?.state === 'failure'
                            ? 'text-danger'
                            : 'text-muted-foreground'
                    }`}
                >
                    <span className="flex-1">{buildNote}</span>
                    {build?.url && (
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 underline"
                            onClick={() => open(build.url!)}
                        >
                            View the build <ExternalLink className="size-3" />
                        </button>
                    )}
                </p>
            )}
            {writing && draft && (
                <ReleaseForm
                    key={checkedAt}
                    entry={entry}
                    draft={draft}
                    onDone={() => {
                        setWriting(false)
                        load()
                    }}
                />
            )}
        </div>
    )
}
