// Pattern check: no GoF pattern (-) — rejected — VitePress build-time data loader; one fetch plus a map through the app's existing releaseToNewsItem.
//
// Build-time data for the What's new page: every published release on GitHub,
// run through the app's own news model so the docs and the app's start page
// describe a release the same way. docs.yml rebuilds the docs whenever a
// release is published, so the page stays current.
import { defineLoader } from 'vitepress'
import type { Release } from '../../../src/renderer/src/lib/github.ts'
import {
    releaseToNewsItem,
    type ReleaseNoteSection,
} from '../../../src/renderer/src/features/news/newsModel.ts'

export interface ChangelogRelease {
    /** "0.0.16" */
    version: string
    /** "v0.0.16", also the heading anchor */
    tag: string
    /** ISO publish time, for ordering among the news items */
    publishedAt: string
    url: string
    /** "4 features · 2 fixes" */
    summary: string
    sections: ReleaseNoteSection[]
}

declare const data: ChangelogRelease[]
export { data }

const RELEASES_API =
    'https://api.github.com/repos/Wolffyx/remappr/releases?per_page=100'

async function fetchReleases(): Promise<Release[]> {
    // CI passes its token so the build isn't caught by the anonymous rate
    // limit; locally it works without one.
    const token = process.env.GITHUB_TOKEN
    const res = await fetch(RELEASES_API, {
        headers: {
            Accept: 'application/vnd.github+json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as Release[]
}

export default defineLoader({
    async load(): Promise<ChangelogRelease[]> {
        let releases: Release[]
        try {
            releases = await fetchReleases()
        } catch (err) {
            // Don't block a docs deploy (news.json edits ride on it) on
            // GitHub: build without releases; the page says so and links out.
            console.warn('[whats-new] could not load GitHub releases:', err)
            return []
        }
        return releases.flatMap((release) => {
            const item = releaseToNewsItem(release)
            if (!item) return []
            return [
                {
                    version: release.tag_name.replace(/^v/, ''),
                    tag: release.tag_name,
                    publishedAt: release.published_at,
                    url: release.html_url,
                    summary: item.body,
                    sections: item.notes ?? [],
                },
            ]
        })
    },
})
