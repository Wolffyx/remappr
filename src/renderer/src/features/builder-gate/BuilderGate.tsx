// Pattern check: no GoF pattern (-) — rejected — one gate component: a server
// check on the web, then open or close; messages live in ./lock.
//
// The builder's own gate, at the mount (the start-page button is only a
// shortcut: anything can flip builderStore.open). Once the builder is paid:
// - the web asks the server about this device's license before it opens
//   (offline or unreachable, the license on this device decides, so a lifetime
//   license still opens offline);
// - it opens only for the account that owns the license (signed in, or the
//   last one signed in when offline).
// Locked, it closes again and says why.
import { lazy, Suspense, useEffect, useState } from 'react'
import { isBuilderFree } from '@/lib/entitlements'
import { loadBuilderComponent } from '@/lib/builderPackage/source'
import { useBuilderAccess } from '@/hooks/use-premium'
import useBuilderStore from '@/stores/builderStore'
import useLicenseStore from '@/stores/licenseStore'
import { isElectron } from '@/transport'
import { explainBuilderLock } from './lock'

// Code-split the full-screen builder: it drags in Monaco (multi-MB), which
// otherwise lands in the entry chunk for users who never open the builder.
const Builder = lazy(loadBuilderComponent)

export function BuilderGate(): JSX.Element | null {
    const access = useBuilderAccess()
    const setOpen = useBuilderStore((s) => s.setOpen)
    // Desktop and the free stage need no server round trip before opening.
    const [checked, setChecked] = useState(
        () => isElectron() || isBuilderFree(),
    )

    useEffect(() => {
        if (checked) return
        let live = true
        void useLicenseStore
            .getState()
            .refresh({ force: true })
            .finally(() => {
                if (live) setChecked(true)
            })
        return () => {
            live = false
        }
    }, [checked])

    useEffect(() => {
        if (!checked || access) return
        explainBuilderLock()
        setOpen(false)
    }, [checked, access, setOpen])

    if (!checked || !access) return null
    return (
        <Suspense fallback={null}>
            <Builder />
        </Suspense>
    )
}
