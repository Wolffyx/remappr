// pattern-check: skip — thin IPC event subscriber + toast trigger
import { useEffect } from 'react'
import { toast } from 'sonner'
import {
    IpcEvents,
    type UpdateAvailablePayload,
} from '../../../shared/ipc-types'
import { compareVersions } from '@shared/semver'
import { getApi } from '@/electron/api'
import { releaseToNewsItem } from '@/features/news/newsModel'
import useNewsStore from '@/stores/newsStore'

const DISMISS_KEY_PREFIX = 'remappr:dismissed-update:'

function pruneStaleDismissKeys(currentLatest: string): void {
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(DISMISS_KEY_PREFIX)) continue
        const ver = key.slice(DISMISS_KEY_PREFIX.length)
        if (ver === currentLatest) continue
        if ((compareVersions(ver, currentLatest) ?? 1) <= 0) {
            localStorage.removeItem(key)
        }
    }
}

/** The toast's body: the notes summarised ("3 features · 2 fixes"), with a
 *  link to the full notes when there are any. */
function UpdateDescription({
    payload,
}: {
    payload: UpdateAvailablePayload
}): JSX.Element {
    const item = releaseToNewsItem({
        tag_name: `v${payload.version}`,
        name: `v${payload.version}`,
        html_url: payload.url,
        body: payload.notes,
        published_at: payload.publishedAt,
        assets: [],
    })
    if (!item?.notes?.length) {
        return <span>A newer Remappr release is available.</span>
    }
    return (
        <span>
            {item.body}.{' '}
            <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={(): void => useNewsStore.getState().openWhatsNew(item)}
            >
                See what’s new
            </button>
        </span>
    )
}

export function UpdateNotification(): null {
    useEffect(() => {
        const api = getApi()
        if (!api) return

        const unsubscribe = api.on(IpcEvents.UPDATE_AVAILABLE, (...args) => {
            const payload = args[0] as UpdateAvailablePayload | undefined
            if (!payload) return

            pruneStaleDismissKeys(payload.version)

            const dismissKey = `${DISMISS_KEY_PREFIX}${payload.version}`
            if (localStorage.getItem(dismissKey) === '1') return

            toast(`Version v${payload.version} is available`, {
                description: <UpdateDescription payload={payload} />,
                duration: Infinity,
                action: {
                    label: 'Download',
                    onClick: () => window.open(payload.url, '_blank'),
                },
                cancel: {
                    label: 'Dismiss',
                    onClick: () => {
                        localStorage.setItem(dismissKey, '1')
                    },
                },
            })
        })

        return unsubscribe
    }, [])

    return null
}
