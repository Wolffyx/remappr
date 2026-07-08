import React, { JSX, useCallback, useEffect } from 'react'
import type { Transport } from '@firmware'
import { connectMock, isUnlocked, pickAdapter } from '@firmware'
import { rememberConnectedDeviceName } from '@/transport/web-serial'
import { LockedOverlay } from '@/features/connection/LockedOverlay'
import useConnectionStore from '@/stores/connectionStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { KeymapEditor } from '@/features/keymap/editor/KeymapEditor'
import { Drawer } from '@/layout/Drawer'
import { SidebarInset, SidebarProvider } from '@/ui/sidebar'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { Toaster } from '@/ui/sonner'
import { Header } from '@/layout/Header'
import { AutoLayoutResolver } from '@/features/firmware/AutoLayoutResolver'
import { DevicePreviewCapture } from '@/features/connection/DevicePreviewCapture'
// import { Footer } from '@/layout/Footer'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { toast } from 'sonner'
import { StartPage } from '@/features/connection/start-page/StartPage'
import { Builder } from '@/features/builder'
import useBuilderStore from '@/stores/builderStore'
import { CoachmarkTour } from '@/features/onboarding/CoachmarkTour'
import { UpdateNotification } from '@/components/UpdateNotification'
import { TitleBar } from '@/layout/TitleBar'
import { isElectron as isElectronEnv } from '@/transport'
import { useConfigRuntimeSync } from '@/hooks/use-config-runtime-sync'
import { cacheKey, loadCached } from '@firmware/qmk/layoutSideload'

// Hoisted so it's a stable reference — an inline object here makes a fresh ref every
// App render, forcing the whole editor subtree (Drawer + KeymapEditor + canvas) to
// re-render on any connection/lock-state change.
const SIDEBAR_STYLE = {
    '--sidebar-width': '15.5rem',
    '--header-height': 'calc(var(--spacing) * 13)',
    '--footer-height': 'calc(var(--spacing) * 8)',
} as React.CSSProperties

// Abort a connection attempt whose adapter handshake never answers (e.g. a
// silent / half-flashed device) so the UI recovers instead of hanging on
// "Connecting" forever. Generous enough not to trip a slow-but-valid BLE link.
const CONNECT_TIMEOUT_MS = 15_000

function App(): JSX.Element {
    // pattern-check: skip — UI sweep, replace store-connection with store-service
    const {
        service,
        setService,
        setDeviceName,
        setLockState,
        setConnectionAbort,
        lockState,
    } = useConnectionStore()
    const { reset } = undoRedoStore()

    // Raise visual-editor edits back into the config (source of truth) so the
    // download modal compiles what the user sees. Mock/demo only.
    useConfigRuntimeSync()

    const updateLockState = useCallback(async (): Promise<void> => {
        if (!service) return
        const next = await service.getLockState()
        setLockState(next)
    }, [service, setLockState])

    useEffect(() => {
        if (!service) {
            reset()
            setLockState('locked')
            // Disconnecting (or closing the demo) ends any builder→editor session,
            // so a subsequently connected real device shows no "back to Builder".
            useBuilderStore.getState().setCameFromBuilder(false)
            return
        }
        updateLockState()
        return service.onLockStateChanged(setLockState)
    }, [service, setLockState, reset, updateLockState])

    const setPreferredAdapterCategory = useUserSettingsStore(
        (s) => s.setPreferredAdapterCategory,
    )
    useEffect(() => {
        if (!service) {
            setPreferredAdapterCategory('zmk')
            return
        }
        const fw = service.deviceInfo.firmware
        setPreferredAdapterCategory(fw === 'zmk' ? 'zmk' : 'qmk')
    }, [service, setPreferredAdapterCategory])

    const onConnect = async (
        t: Transport,
        communication: 'serial' | 'ble' | 'hid',
    ): Promise<boolean> => {
        const adapter = await pickAdapter(t, { transportKind: communication })
        if (!adapter) {
            toast.error('Failed to connect to the selected device.', {
                description: 'No firmware adapter handled the device.',
            })
            return false
        }
        // Fresh controller per attempt: the handshake below can hang on a silent
        // device, so a timeout aborts it (adapter.connect honours the signal).
        // A previously-aborted controller would poison the retry, so publish a
        // new one to the store — disconnect still aborts whichever is live.
        const abort = new AbortController()
        setConnectionAbort(abort)
        const timeout = setTimeout(
            () => abort.abort(new Error('Connection timed out')),
            CONNECT_TIMEOUT_MS,
        )
        try {
            const next = await adapter.connect(t, abort.signal)
            // Re-apply a previously imported QMK/VIA/Keychron layout BEFORE the
            // service is exposed, so the first keymap read (Drawer) already
            // reflects it. Doing it here — rather than in a sibling effect —
            // keeps it off the same transport at the same time as the initial
            // getKeymap, avoiding a last-writer-wins race on the keymap store.
            if (next.capabilities.layoutSideloadable && next.applyLayout) {
                const key = cacheKey(next.deviceInfo)
                const def = key ? loadCached(key) : null
                if (def) {
                    try {
                        await next.applyLayout(def)
                    } catch (err) {
                        console.warn('Failed to restore cached layout', err)
                    }
                }
            }
            next.onClosed((): void => {
                setDeviceName(null)
                setService(null)
            })
            setDeviceName(next.deviceInfo.name)
            if (communication === 'serial') {
                rememberConnectedDeviceName(next.deviceInfo.name)
            }
            setService(next, communication)
            return true
        } catch (err) {
            toast.error('Failed to connect to the selected device.', {
                description: err instanceof Error ? err.message : String(err),
            })
            return false
        } finally {
            clearTimeout(timeout)
        }
    }

    const onDemoConnect = async (): Promise<void> => {
        try {
            const next = await connectMock()
            next.onClosed((): void => {
                setDeviceName(null)
                setService(null)
            })
            setDeviceName(next.deviceInfo.name)
            setService(next)
        } catch (err) {
            toast.error('Failed to start demo mode.', {
                description: err instanceof Error ? err.message : String(err),
            })
        }
    }

    const isElectron = isElectronEnv()

    useEffect(() => {
        if (!isElectron) return
        document.body.classList.add('app-electron')
        return () => document.body.classList.remove('app-electron')
    }, [isElectron])

    // Pause the per-key RGB glow animations while the window/tab is hidden — frees the
    // compositor from re-filtering N hue-rotate layers when nothing is on screen.
    useEffect(() => {
        const sync = (): void => {
            document.body.classList.toggle('kl-paused', document.hidden)
        }
        sync()
        document.addEventListener('visibilitychange', sync)
        return () => document.removeEventListener('visibilitychange', sync)
    }, [])

    const builderOpen = useBuilderStore((s) => s.open)

    const showEditor =
        !!service && !(service.capabilities.lock && !isUnlocked(lockState))

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div className="flex h-screen flex-col overflow-hidden">
                {/* The editor, the full-screen builder, and the start page each
                    own a header with an inline drag region + window controls;
                    only the locked overlay (service present but locked) still
                    needs the standalone drag bar. */}
                {!showEditor && !builderOpen && !!service && <TitleBar />}
                <div className="flex-1 min-h-0 overflow-hidden">
                    {builderOpen ? (
                        <ErrorBoundary>
                            <Builder />
                        </ErrorBoundary>
                    ) : service ? (
                        service.capabilities.lock && !isUnlocked(lockState) ? (
                            <ErrorBoundary>
                                <LockedOverlay />
                            </ErrorBoundary>
                        ) : (
                            <ErrorBoundary>
                                <SidebarProvider
                                    className="!min-h-0 h-full"
                                    style={SIDEBAR_STYLE}
                                >
                                    <Drawer />
                                    <SidebarInset>
                                        <Header />
                                        <AutoLayoutResolver />
                                        <DevicePreviewCapture />
                                        <ErrorBoundary>
                                            <KeymapEditor />
                                        </ErrorBoundary>
                                        {/*<Footer />*/}
                                    </SidebarInset>
                                    <CoachmarkTour />
                                </SidebarProvider>
                            </ErrorBoundary>
                        )
                    ) : (
                        <ErrorBoundary>
                            <StartPage
                                onTransportCreated={onConnect}
                                onDemoConnect={onDemoConnect}
                            />
                        </ErrorBoundary>
                    )}
                </div>
            </div>
            <UpdateNotification />
            <Toaster richColors position="top-center" />
        </ThemeProvider>
    )
}

export default App
