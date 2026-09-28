// pattern-check: skip — assertions over the launch-time "what's new" check
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useNewsStore from '@/stores/newsStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { type NewsItem, releaseToNewsItem } from './newsModel'
import { checkWhatsNewOnLaunch, openCurrentReleaseNotes } from './whatsNew'

vi.mock('@/lib/constants', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/constants')>()),
    APP_VERSION: '0.0.20',
}))
const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const rel = (version: string, section: string): NewsItem =>
    releaseToNewsItem({
        tag_name: `v${version}`,
        name: `v${version}`,
        html_url: `https://github.com/Wolffyx/remappr/releases/tag/v${version}`,
        body: `### ${section}\n\n* change in ${version}\n`,
        published_at: '2026-09-28T10:00:00Z',
        assets: [],
    })!

const OLD = [rel('0.0.19', 'Features'), rel('0.0.18', 'Features')]
const WITH_CURRENT = [rel('0.0.20', 'Features'), ...OLD]

/** refetch() that swaps in `next` as the fetched release list. */
function stubRefetch(next: NewsItem[]): ReturnType<typeof vi.fn> {
    const refetch = vi.fn(async () => {
        useNewsStore.setState({ releases: next })
    })
    useNewsStore.setState({ refetch })
    return refetch
}

beforeEach(() => {
    toastError.mockReset()
    useNewsStore.setState({ releases: [], whatsNew: null })
    useUserSettingsStore.setState({ lastRunVersion: null })
})

describe('checkWhatsNewOnLaunch', () => {
    it('only records the version on a first launch', async () => {
        const refetch = stubRefetch(WITH_CURRENT)
        await checkWhatsNewOnLaunch()
        expect(useUserSettingsStore.getState().lastRunVersion).toBe('0.0.20')
        expect(useNewsStore.getState().whatsNew).toBeNull()
        expect(refetch).not.toHaveBeenCalled()
    })

    it('only records the version on a downgrade', async () => {
        useUserSettingsStore.setState({ lastRunVersion: '0.0.25' })
        stubRefetch(WITH_CURRENT)
        await checkWhatsNewOnLaunch()
        expect(useUserSettingsStore.getState().lastRunVersion).toBe('0.0.20')
        expect(useNewsStore.getState().whatsNew).toBeNull()
    })

    it('does nothing when the version did not change', async () => {
        useUserSettingsStore.setState({ lastRunVersion: '0.0.20' })
        const refetch = stubRefetch(WITH_CURRENT)
        await checkWhatsNewOnLaunch()
        expect(useNewsStore.getState().whatsNew).toBeNull()
        expect(refetch).not.toHaveBeenCalled()
    })

    it('opens the notes after an upgrade, refetching a stale cache', async () => {
        useUserSettingsStore.setState({ lastRunVersion: '0.0.18' })
        useNewsStore.setState({ releases: OLD })
        const refetch = stubRefetch(WITH_CURRENT)
        await checkWhatsNewOnLaunch()
        expect(refetch).toHaveBeenCalledOnce()
        expect(useNewsStore.getState().whatsNew?.notes?.[0].entries).toEqual([
            { text: 'Change in 0.0.20' },
            { text: 'Change in 0.0.19' },
        ])
        expect(useUserSettingsStore.getState().lastRunVersion).toBe('0.0.20')
    })

    it('tries again next launch when the release is still missing', async () => {
        useUserSettingsStore.setState({ lastRunVersion: '0.0.18' })
        stubRefetch(OLD)
        await checkWhatsNewOnLaunch()
        expect(useNewsStore.getState().whatsNew).toBeNull()
        expect(useUserSettingsStore.getState().lastRunVersion).toBe('0.0.18')
    })

    it('stays quiet but records the version for a fixes-only update', async () => {
        useUserSettingsStore.setState({ lastRunVersion: '0.0.19' })
        stubRefetch([rel('0.0.20', 'Bug Fixes'), ...OLD])
        await checkWhatsNewOnLaunch()
        expect(useNewsStore.getState().whatsNew).toBeNull()
        expect(useUserSettingsStore.getState().lastRunVersion).toBe('0.0.20')
    })
})

describe('openCurrentReleaseNotes', () => {
    it('opens the running version’s release', async () => {
        useNewsStore.setState({ releases: WITH_CURRENT })
        await openCurrentReleaseNotes()
        expect(useNewsStore.getState().whatsNew?.version).toBe('v0.0.20')
    })

    it('says so when the release cannot be found', async () => {
        stubRefetch(OLD)
        await openCurrentReleaseNotes()
        expect(useNewsStore.getState().whatsNew).toBeNull()
        expect(toastError).toHaveBeenCalledOnce()
    })
})
