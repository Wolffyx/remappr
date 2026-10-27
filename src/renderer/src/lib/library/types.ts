// pattern-check: skip — type declarations for the local library entry.
//
// One shape for everything a user keeps: builder boards and device layouts
// (type `device`) and editor keymaps (type `config`). It mirrors a cloud
// `library_items` row so sync can map one onto the other.
import type { PreviewKey } from '@/stores/devicePreviewStore'

export type LibraryItemType = 'device' | 'config'

export type LibraryDocKind =
    | 'remappr.keymap'
    | 'remappr.device-layout'
    | 'remappr.device'

export type LibrarySyncState =
    | 'local'
    | 'synced'
    | 'pending'
    | 'conflict'
    | 'over_quota'
    | 'needs_builder'

export interface LibrarySync {
    /** The account this entry syncs with; never pushed to another one. */
    accountId?: string
    itemId?: string
    /** The cloud head version last seen. */
    baseVersion?: number
    dirty: boolean
    state: LibrarySyncState
    lastSyncedAt?: number
    /** The cloud head when a conflict was found. */
    remoteVersion?: number
    /** Kept on this device only; sync never pushes it. */
    localOnly?: boolean
}

/** List facts shown without parsing `source`. */
export interface LibrarySummary {
    keys?: number
    controls?: number
    layers?: number
    /** Device form (mouse, gamepad …) for device layouts. */
    form?: string
}

export interface LibraryEntry {
    /** uuid; becomes the cloud item's client_id so uploads are idempotent. */
    localId: string
    type: LibraryItemType
    kind: LibraryDocKind
    name: string
    /** The document, serialized as saved (keeps its surface form). */
    source: string
    preview?: PreviewKey[]
    summary: LibrarySummary
    /** Kind-specific data kept beside the document, e.g. a device layout's
     *  firmware targets. */
    extra?: Record<string, unknown>
    createdAt: number
    updatedAt: number
    sync: LibrarySync
}

/** What a caller supplies to save a new entry; ids, times and sync are filled. */
export type NewLibraryEntry = Omit<
    LibraryEntry,
    'localId' | 'createdAt' | 'updatedAt' | 'sync'
> & { localId?: string }

export const LOCAL_SYNC: LibrarySync = { dirty: false, state: 'local' }
