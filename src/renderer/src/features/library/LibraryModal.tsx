// Pattern check: no GoF pattern (-) — rejected — list UI over libraryStore; the
// host passes which sections it can open (a dispatch map in ./sections).
//
// The one Library surface. The builder, the editor and the devices screens all
// open it; each says which kinds of entry it can open and what "Save current"
// saves. Entries live in the local IndexedDB library, so saves are unlimited and
// need no account.
import { useEffect, useMemo } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { DeviceForm } from '@firmware/devices/types'
import { Modal, type ModalSize } from '@/ui/modal'
import { Button } from '@/ui/button'
import { MiniKeyboardPreview } from '@/features/connection/start-page/MiniKeyboardPreview'
import { FORM_ICON } from '@/features/devices/formIcons'
import { FORM_LABEL } from '@/lib/devices/labels'
import type { LibraryEntry } from '@/lib/library/types'
import useLibraryStore from '@/stores/libraryStore'
import {
    SECTION_ORDER,
    SECTION_TITLE,
    sectionOf,
    type LibraryOpener,
    type LibrarySection,
} from './sections'

export interface LibrarySaveAction {
    label: string
    disabled?: boolean
    /** Saves the current document; resolves its name for the toast. */
    run: () => Promise<string>
}

export interface LibraryModalProps {
    open: boolean
    onClose: () => void
    onBack?: () => void
    size?: ModalSize
    title?: string
    subtitle?: string
    save?: LibrarySaveAction
    /** The sections this host can open. Others are not listed. */
    openers: Partial<Record<LibrarySection, LibraryOpener>>
    emptyText?: string
}

function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`
}

function fmtDate(ms: number): string {
    return new Date(ms).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

/** The facts line under an entry's name. */
function facts(entry: LibraryEntry): string {
    const { keys, controls, layers, form } = entry.summary
    const parts = [
        form ? FORM_LABEL[form as DeviceForm] : undefined,
        keys !== undefined ? plural(keys, 'key') : undefined,
        controls !== undefined ? plural(controls, 'control') : undefined,
        layers !== undefined ? plural(layers, 'layer') : undefined,
        fmtDate(entry.updatedAt),
    ]
    return parts.filter(Boolean).join(' · ')
}

// pattern-check: skip presentational thumbnail; reuses MiniKeyboardPreview / FORM_ICON
function EntryThumb({ entry }: { entry: LibraryEntry }): JSX.Element | null {
    const form = entry.summary.form as DeviceForm | undefined
    if (form && FORM_ICON[form]) {
        const Icon = FORM_ICON[form]
        return (
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                <Icon className="size-5" />
            </span>
        )
    }
    if (!entry.preview?.length) return null
    return (
        <div className="grid h-14 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/30">
            <MiniKeyboardPreview keys={entry.preview} oneU={7} />
        </div>
    )
}

export function LibraryModal({
    open,
    onClose,
    onBack,
    size = 'sm',
    title = 'Library',
    subtitle = 'Saved on this machine',
    save,
    openers,
    emptyText = 'Nothing saved yet. Save what you are working on to reopen it later.',
}: LibraryModalProps): JSX.Element {
    const entries = useLibraryStore((s) => s.entries)
    const status = useLibraryStore((s) => s.status)
    const load = useLibraryStore((s) => s.load)
    const remove = useLibraryStore((s) => s.remove)

    useEffect(() => {
        if (open) void load()
    }, [open, load])

    const sections = useMemo(
        () =>
            SECTION_ORDER.filter((s) => openers[s]).map((section) => ({
                section,
                items: entries.filter((e) => sectionOf(e) === section),
            })),
        [entries, openers],
    )
    const total = sections.reduce((n, s) => n + s.items.length, 0)

    const handleSave = async (): Promise<void> => {
        if (!save) return
        try {
            toast.success(`Saved "${await save.run()}" to your library`)
        } catch (e) {
            toast.error(`Could not save: ${e instanceof Error ? e.message : e}`)
        }
    }

    const handleOpen = async (entry: LibraryEntry): Promise<void> => {
        const opener = openers[sectionOf(entry)]
        if (!opener) return
        if (!(await opener(entry))) {
            toast.error(`Failed to open "${entry.name}" — it is invalid`)
            return
        }
        toast.success(`Opened "${entry.name}"`)
        onClose()
    }

    const handleDelete = async (entry: LibraryEntry): Promise<void> => {
        try {
            await remove(entry.localId)
            toast.success(`Removed "${entry.name}"`)
        } catch (e) {
            toast.error(
                `Could not remove: ${e instanceof Error ? e.message : e}`,
            )
        }
    }

    return (
        <Modal
            size={size}
            opened={open}
            onClose={onClose}
            onBack={onBack}
            title={title}
            subtitle={subtitle}
            headerIcon={<Layers />}
            showFooter={false}
        >
            <div className="space-y-4">
                {save && (
                    <Button
                        onClick={() => void handleSave()}
                        disabled={save.disabled}
                        className="flex w-full items-center justify-center gap-2"
                    >
                        <Plus className="size-4" /> {save.label}
                    </Button>
                )}

                {status === 'error' && (
                    <p className="py-2 text-center text-sm text-destructive">
                        The library could not be read in this browser.
                    </p>
                )}

                {total === 0 && status !== 'error' ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        {emptyText}
                    </p>
                ) : (
                    sections
                        .filter((s) => s.items.length > 0)
                        .map(({ section, items }) => (
                            <div key={section}>
                                {sections.length > 1 && (
                                    <div className="eyebrow mb-2">
                                        {SECTION_TITLE[section]}
                                    </div>
                                )}
                                <ul className="space-y-2">
                                    {items.map((e) => (
                                        <li
                                            key={e.localId}
                                            className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                                        >
                                            <EntryThumb entry={e} />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-panel-title font-semibold">
                                                    {e.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {facts(e)}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    void handleOpen(e)
                                                }
                                            >
                                                Open
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                aria-label={`Delete ${e.name}`}
                                                onClick={() =>
                                                    void handleDelete(e)
                                                }
                                            >
                                                <Trash2 className="size-4 text-muted-foreground" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                )}
            </div>
        </Modal>
    )
}
