// Pattern check: no GoF pattern (-) — rejected — thin React hooks re-reading
// the entitlement predicates on change events; no abstraction.
import { useEffect, useState } from 'react'
import {
    hasBuilderAccess,
    getBuilderStage,
    ENTITLEMENTS_CHANGE_EVENT,
    PLAN_STORAGE_KEY,
    type BuilderStage,
} from '@/lib/entitlements'

/** Re-read `read` whenever the cached plan changes in this tab (the change
 *  event) or another one (the storage event). */
function useEntitlement<T>(read: () => T): T {
    const [value, setValue] = useState(read)
    useEffect(() => {
        const reeval = (): void => setValue(read())
        const onStorage = (e: StorageEvent): void => {
            if (e.key === null || e.key === PLAN_STORAGE_KEY) reeval()
        }
        window.addEventListener('storage', onStorage)
        window.addEventListener(ENTITLEMENTS_CHANGE_EVENT, reeval)
        return () => {
            window.removeEventListener('storage', onStorage)
            window.removeEventListener(ENTITLEMENTS_CHANGE_EVENT, reeval)
        }
    }, [read])
    return value
}

/** Reactive builder-access flag (see `hasBuilderAccess`). */
export function useBuilderAccess(): boolean {
    return useEntitlement(hasBuilderAccess)
}

/** The builder's lifecycle stage (drives the badge label + "free for now" copy). */
export function useBuilderStage(): BuilderStage {
    return useEntitlement(getBuilderStage)
}
