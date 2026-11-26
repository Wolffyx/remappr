// Pattern check: Dispatch Map (Tier 0) — applied — one toast per update kind
// ('ready', 'needs-host'), looked up by kind.
//
// Toasts for what the builder delivery found (lib/builderPackage/updates):
// a newer builder was downloaded (with its notes), or a newer one exists
// that needs a newer app. Each version is announced once per app start; a
// dismissed "needs a newer app" stays dismissed for that version.
import { useEffect } from 'react'
import { toast } from 'sonner'
import { IpcChannels } from '@shared/ipc-types'
import { getApi } from '@/electron/api'
import { releaseToNewsItem } from '@/features/news/newsModel'
import useNewsStore from '@/stores/newsStore'
import {
    onBuilderUpdate,
    type BuilderUpdate,
} from '@/lib/builderPackage/updates'

const DISMISS_PREFIX = 'remappr:dismissed-builder-host:'
const shown = new Set<string>()

function openNotes(version: string, changelog: string): void {
    const item = releaseToNewsItem({
        tag_name: `v${version}`,
        name: `Builder ${version}`,
        html_url: '',
        body: changelog,
        published_at: new Date().toISOString(),
        assets: [],
    })
    if (item)
        useNewsStore
            .getState()
            .openWhatsNew({ ...item, title: `Builder ${version}` })
}

function readDismissed(key: string): boolean {
    try {
        return localStorage.getItem(key) === '1'
    } catch {
        // Storage blocked: nothing was dismissed.
        return false
    }
}

function rememberDismissed(key: string): void {
    try {
        localStorage.setItem(key, '1')
    } catch {
        // Storage blocked: it shows again next start, which is harmless.
    }
}

function showReady(u: Extract<BuilderUpdate, { kind: 'ready' }>): void {
    toast.success(`Builder ${u.version} is ready`, {
        description:
            'If the builder is open, it updates the next time you open it.',
        ...(u.changelog.trim()
            ? {
                  action: {
                      label: 'What’s new',
                      onClick: () => openNotes(u.version, u.changelog),
                  },
              }
            : {}),
    })
}

function showNeedsHost(
    u: Extract<BuilderUpdate, { kind: 'needs-host' }>,
): void {
    const key = DISMISS_PREFIX + u.version
    if (readDismissed(key)) return
    const api = getApi()
    toast(`Builder ${u.version} needs a newer Remappr`, {
        description: api
            ? 'Update the app to get it. The builder you have keeps working.'
            : 'Reload when Remappr offers an update. The builder you have keeps working.',
        duration: Infinity,
        ...(api
            ? {
                  action: {
                      label: 'Check for updates',
                      onClick: () => void api.invoke(IpcChannels.UPDATES_CHECK),
                  },
              }
            : {}),
        cancel: { label: 'Dismiss', onClick: () => rememberDismissed(key) },
    })
}

const SHOW: {
    [K in BuilderUpdate['kind']]: (
        u: Extract<BuilderUpdate, { kind: K }>,
    ) => void
} = {
    ready: showReady,
    'needs-host': showNeedsHost,
}

function show(update: BuilderUpdate): void {
    const id = `${update.kind}:${update.version}`
    if (shown.has(id)) return
    shown.add(id)
    ;(SHOW[update.kind] as (u: BuilderUpdate) => void)(update)
}

export function BuilderUpdateNotice(): null {
    useEffect(() => onBuilderUpdate(show), [])
    return null
}
