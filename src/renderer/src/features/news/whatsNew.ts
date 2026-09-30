// Pattern check: no GoF pattern (-) — rejected — two async helpers over the news and settings stores; guard clauses cover the version cases.
//
// "What's new": release notes shown app-wide, outside the start page (see
// WhatsNewDialog). The running version is the build-time APP_VERSION, so the
// desktop app and the web build behave the same: a newer version than the
// last launch opens the notes of everything in between, once.
import { toast } from 'sonner'
import { compareVersions } from '@shared/semver'
import { APP_VERSION } from '@/lib/constants'
import useNewsStore from '@/stores/newsStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { type NewsItem, type WhatsNew, whatsNewSince } from './newsModel'

/** The cached release list, refetched once when `pick` finds nothing in it
 *  (the cache can predate the release this build came from). */
async function fromReleases<T>(
    pick: (releases: NewsItem[]) => T,
    found: (value: T) => boolean,
): Promise<T> {
    const cached = pick(useNewsStore.getState().releases)
    if (found(cached)) return cached
    await useNewsStore.getState().refetch()
    return pick(useNewsStore.getState().releases)
}

/** On launch: record the running version and, when it's newer than the last
 *  launch, open what changed. A first launch and a downgrade only record it.
 *  If the running version's release can't be found yet (offline, or a build
 *  that was never released), nothing is recorded and the next launch tries
 *  again. */
export async function checkWhatsNewOnLaunch(): Promise<void> {
    const { lastRunVersion, setLastRunVersion } =
        useUserSettingsStore.getState()
    if (lastRunVersion === null) {
        setLastRunVersion(APP_VERSION)
        return
    }
    const diff = compareVersions(APP_VERSION, lastRunVersion)
    if (diff === 0) return
    if (diff === null || diff < 0) {
        setLastRunVersion(APP_VERSION)
        return
    }
    const result = await fromReleases<WhatsNew>(
        (releases) => whatsNewSince(releases, lastRunVersion, APP_VERSION),
        (r) => r.kind !== 'pending',
    )
    if (result.kind === 'pending') return
    setLastRunVersion(APP_VERSION)
    if (result.kind === 'show')
        useNewsStore.getState().openWhatsNew(result.item)
}

/** Settings → About: the running version's release notes, whatever they hold. */
export async function openCurrentReleaseNotes(): Promise<void> {
    const item = await fromReleases(
        (releases) =>
            releases.find(
                (n) => compareVersions(n.version ?? '', APP_VERSION) === 0,
            ),
        (n) => !!n,
    )
    if (!item) {
        toast.error(`No release notes found for v${APP_VERSION}`, {
            description:
                'GitHub could not be reached, or this build was never released.',
        })
        return
    }
    useNewsStore.getState().openWhatsNew(item)
}
