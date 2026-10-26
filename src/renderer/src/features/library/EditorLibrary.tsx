// pattern-check: skip — binds the shared LibraryModal to the editor's config.
//
// The editor's Library: save the keymap being edited, reopen any saved keymap
// or builder board (both are `remappr.keymap` documents).
import { useMemo } from 'react'
import { keymapEntry } from '@/lib/library/entries'
import useConfigStore from '@/stores/configStore'
import useLibraryStore from '@/stores/libraryStore'
import { LibraryModal } from './LibraryModal'
import { openConfigSource } from './openConfig'
import type { LibraryOpener, LibrarySection } from './sections'

interface EditorLibraryProps {
    opened: boolean
    onClose: () => void
}

const openKeymap: LibraryOpener = (entry) => openConfigSource(entry.source)

export function EditorLibrary({
    opened,
    onClose,
}: EditorLibraryProps): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const openers = useMemo<Partial<Record<LibrarySection, LibraryOpener>>>(
        () => ({ keymap: openKeymap, board: openKeymap }),
        [],
    )
    return (
        <LibraryModal
            open={opened}
            onClose={onClose}
            subtitle="Keymaps and boards saved on this machine"
            openers={openers}
            save={{
                label: 'Save current keymap',
                disabled: !config,
                run: async () => {
                    if (!config) throw new Error('no keymap loaded')
                    await useLibraryStore
                        .getState()
                        .save(keymapEntry(config, 'config'))
                    return config.meta.name
                },
            }}
            emptyText="No saved keymaps yet. Save the keymap you are editing to reopen it later."
        />
    )
}
