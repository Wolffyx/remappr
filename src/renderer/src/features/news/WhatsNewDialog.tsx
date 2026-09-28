// pattern-check: skip — mounts the shared release notes view on the app-wide store slot
import { useEffect } from 'react'
import useNewsStore from '@/stores/newsStore'
import { ReleaseNotesView } from './ReleaseNotesDialog'
import { checkWhatsNewOnLaunch } from './whatsNew'

// Once per app start, not per mount (StrictMode mounts twice in dev).
let launchChecked = false

/** Release notes opened outside the start page: the post-update popup, the
 *  update toast and Settings → About. Mounted once in App. */
export function WhatsNewDialog(): JSX.Element {
    const item = useNewsStore((s) => s.whatsNew)
    const close = useNewsStore((s) => s.closeWhatsNew)

    useEffect(() => {
        if (launchChecked) return
        launchChecked = true
        checkWhatsNewOnLaunch().catch((e: unknown) =>
            console.warn('[news] what’s new check failed:', e),
        )
    }, [])

    return <ReleaseNotesView item={item} onClose={close} />
}
