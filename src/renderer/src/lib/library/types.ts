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

/** Where a linked entry stands against its GitHub branch. */
export type GitSyncState =
    | 'synced'
    | 'ahead'
    | 'pushing'
    | 'offline'
    | 'conflict'
    | 'hand_edited'
    | 'error'

/** An entry's GitHub remote (plan §6c A2). Kept on the entry, so it works
 *  with no account; a synced entry mirrors it in `item_git_links`. */
export interface GitLink {
    /** owner/name */
    repo: string
    branch: string
    /** Folder for `<slug>.remappr.json`; generated files go where their
     *  firmware expects them. */
    folder: string
    /** Compiler target generated beside the source; null: the source only. */
    target: string | null
    /** Push each saved version on its own. */
    autoPush: boolean
    /** The file name, fixed at link time so a rename does not move it. */
    slug: string
    /** Versions up to this one predate the link and are never pushed. */
    linkedAt: number
    lastSyncedSha?: string
    lastSyncedAt?: number
    /** Git blob sha of the source as of lastSyncedSha. */
    syncedBlob?: string
    /** The local version the last push or pull matched. */
    syncedN?: number
    /** ETag of the last branch read (unchanged branch: a free 304). */
    etag?: string
    state?: GitSyncState
    error?: string
    /** The branch head whose document conflicts with local edits. */
    conflictSha?: string
    /** Generated files edited on GitHub since Remappr wrote them. */
    handEdited?: string[]
    /** Generated files the user keeps as edited: never written again. */
    keepTheirs?: string[]
    /** The last "Release to GitHub" made from this device. */
    lastRelease?: GitRelease
}

export interface GitRelease {
    tag: string
    url: string
    at: number
    /** attached: the repo's workflow builds the tag and attaches the
     *  firmware; manual: a workflow edited by hand has no release step;
     *  none: no firmware workflow (the Remappr file only). */
    firmware: 'attached' | 'manual' | 'none'
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
    git?: GitLink
}

/** What a caller supplies to save a new entry; ids, times and sync are filled. */
export type NewLibraryEntry = Omit<
    LibraryEntry,
    'localId' | 'createdAt' | 'updatedAt' | 'sync' | 'git'
> & { localId?: string }

export const LOCAL_SYNC: LibrarySync = { dirty: false, state: 'local' }
