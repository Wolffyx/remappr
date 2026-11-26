// Pattern check: Dispatch Map (Tier 0) — applied — lock reason → message table
// shared by the start-page entry and the builder mount.
import { toast } from 'sonner'
import { builderLock, type BuilderLock } from '@/lib/entitlements'

const LOCKED: Record<BuilderLock, { title: string; description: string }> = {
    sign_in: {
        title: 'Sign in to use the builder',
        description:
            'Sign in with the account that holds your builder license (Settings → Account).',
    },
    activate: {
        title: 'Activate this device',
        description:
            'Your plan includes the builder: activate this device in Settings → Account → Builder devices.',
    },
    buy: {
        title: 'The keyboard builder is a premium feature',
        description: 'Sign in to an account that includes it.',
    },
}

/** Toast why the builder is locked; false when it is open to use. */
export function explainBuilderLock(): boolean {
    const lock = builderLock()
    if (!lock) return false
    toast.info(LOCKED[lock].title, { description: LOCKED[lock].description })
    return true
}
