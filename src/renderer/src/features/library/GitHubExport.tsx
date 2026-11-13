// Pattern check: no GoF pattern (-) — rejected — one component that picks
// the library item and hands it to the existing GitPanel (no parallel copy).
//
// "Export & build" → GitHub: keeps the board in the user's repo through a
// library item (GitHub sync is per item). Pick the item (a linked one for
// this board, or a new one), bring it up to this board, then the regular
// GitHub panel links, syncs and releases it.
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { serializeKeymap, type ConfigKeymap } from '@firmware/config'
import { createLogger } from '@shared/logger'
import { GitHubIcon as Github } from '@/components/GitHubIcon'
import { keymapEntry } from '@/lib/library/entries'
import type { LibraryItemType } from '@/lib/library/types'
import useHistoryStore from '@/stores/historyStore'
import useLibraryStore from '@/stores/libraryStore'
import { AppSelect } from '@/ui/app-select'
import { Button } from '@/ui/button'
import { GitPanel } from './GitPanel'
import { defaultExportItem, exportCandidates, holdsBoard } from './githubExport'

const log = createLogger('GitHubExport')
const NEW = '__new__'
const VERSION_MESSAGE = 'From Export & build'

interface GitHubExportProps {
    config: ConfigKeymap
    /** The library item type the board is kept as. */
    type: LibraryItemType
}

export function GitHubExport({ config, type }: GitHubExportProps): JSX.Element {
    const entries = useLibraryStore((s) => s.entries)
    const status = useLibraryStore((s) => s.status)
    const [picked, setPicked] = useState<string | null | undefined>()
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (status === 'idle') void useLibraryStore.getState().load()
    }, [status])

    const name = config.meta.name
    const source = useMemo(() => serializeKeymap(config), [config])
    const candidates = useMemo(
        () => exportCandidates(entries, type, name),
        [entries, type, name],
    )
    const chosenId =
        picked === undefined ? defaultExportItem(candidates, name) : picked
    const entry = candidates.find((e) => e.localId === chosenId) ?? null
    const current = useMemo(
        () => (entry ? holdsBoard(entry, source) : false),
        [entry, source],
    )

    const bringUp = async (): Promise<void> => {
        setBusy(true)
        try {
            const next = keymapEntry(config, type)
            const library = useLibraryStore.getState()
            const { name: n, source: s, preview, summary } = next
            const id = entry
                ? (
                      await library.update(entry.localId, {
                          name: n,
                          source: s,
                          preview,
                          summary,
                      })
                  )?.localId
                : (await library.save(next)).localId
            if (!id) throw new Error('the library item is gone')
            await useHistoryStore.getState().checkpoint(id, VERSION_MESSAGE)
            setPicked(id)
        } catch (e) {
            log.error('could not save the board for GitHub', e)
            toast.error('Could not save the board to your library')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-2">
            <label className="block space-y-1 text-xs font-semibold">
                <span className="block">Library item</span>
                <AppSelect
                    value={chosenId ?? NEW}
                    onChange={(e) =>
                        setPicked(
                            e.target.value === NEW ? null : e.target.value,
                        )
                    }
                    aria-label="Library item to keep on GitHub"
                >
                    <option value={NEW}>New library item</option>
                    {candidates.map((e) => (
                        <option key={e.localId} value={e.localId}>
                            {e.git ? `${e.name} · ${e.git.repo}` : e.name}
                        </option>
                    ))}
                </AppSelect>
            </label>
            {entry && current ? (
                <GitPanel entry={entry} />
            ) : (
                <section className="space-y-2 rounded-xl border bg-background p-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold">
                        <Github className="size-3.5" /> GitHub
                    </h4>
                    <div className="flex items-center gap-2">
                        <p className="flex-1 text-xs text-muted-foreground">
                            {entry
                                ? `"${entry.name}" in your library differs from this board. Update it to keep this board on GitHub.`
                                : 'GitHub keeps items of your library: save this board as one, then link it to a repo.'}
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void bringUp()}
                        >
                            {entry ? 'Update it' : 'Save to library'}
                        </Button>
                    </div>
                </section>
            )}
        </div>
    )
}
