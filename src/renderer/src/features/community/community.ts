// pattern-check: skip — memoized accessors for the community, social and
// collection repositories plus pure helpers for share links.
//
// Shared by the community surfaces: one CommunityLibrary over the app's cloud
// client (null in builds without a backend), and the share-link format.
import { authSiteUrl } from '@/lib/cloud/authRedirect'
import { getCloudClient } from '@/lib/cloud/client'
import { isElectron } from '@/transport'
import {
    createCollectionLibrary,
    readCollectionMembers,
    type CollectionLibrary,
    type CollectionMember,
} from '@/lib/library/collectionLibrary'
import {
    createSocialLibrary,
    type SocialLibrary,
} from '@/lib/library/socialLibrary'
import useAuthStore from '@/stores/authStore'
import {
    createCommunityLibrary,
    type CommunityLibrary,
} from '@/lib/library/communityLibrary'

let pending: Promise<CommunityLibrary | null> | null = null

export function getCommunity(): Promise<CommunityLibrary | null> {
    pending ??= getCloudClient().then((c) =>
        c ? createCommunityLibrary(c) : null,
    )
    return pending
}

const SHARE_PARAM = 'share'

/** The web link that opens an unlisted item. The desktop app has no web
 *  address of its own, so it links to the web site. */
export function shareUrl(token: string): string {
    const base = isElectron() ? authSiteUrl() : window.location.origin
    const url = new URL(base)
    url.searchParams.set(SHARE_PARAM, token)
    return url.toString()
}

/** The token in a pasted share link (or a bare token); null when none. */
export function shareTokenFrom(text: string): string | null {
    const trimmed = text.trim()
    if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase()
    try {
        const token = new URL(trimmed).searchParams.get(SHARE_PARAM)
        return token && /^[0-9a-f]{64}$/i.test(token)
            ? token.toLowerCase()
            : null
    } catch {
        // Not a URL and not a token.
        return null
    }
}

/** Read and remove ?share= from the current address. */
export function takeShareTokenFromLocation(): string | null {
    const url = new URL(window.location.href)
    const token = url.searchParams.get(SHARE_PARAM)
    if (!token) return null
    url.searchParams.delete(SHARE_PARAM)
    window.history.replaceState(window.history.state, '', url.toString())
    return shareTokenFrom(token)
}

let social: Promise<SocialLibrary | null> | null = null

export function getSocial(): Promise<SocialLibrary | null> {
    social ??= getCloudClient().then((c) => (c ? createSocialLibrary(c) : null))
    return social
}

/** The signed-in user's collections, or null when signed out. */
export async function getCollections(): Promise<CollectionLibrary | null> {
    const owner = useAuthStore.getState().user?.id
    const client = owner ? await getCloudClient() : null
    return client && owner ? createCollectionLibrary(client, owner) : null
}

/** A collection's visible members; works signed out too. */
export async function getCollectionMembers(
    collectionId: string,
): Promise<CollectionMember[]> {
    const client = await getCloudClient()
    return client ? readCollectionMembers(client, collectionId) : []
}
