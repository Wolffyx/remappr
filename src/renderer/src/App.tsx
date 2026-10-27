import { JSX, Suspense, lazy, useCallback, useEffect } from 'react'
import { UnlockPanel } from '@/features/connection/UnlockPanel'
import { LeaveGuardDialog } from '@/features/connection/LeaveGuardDialog'
import { DongleLanding } from '@/features/connection/DongleLanding'
import { DeviceEditor } from '@/features/devices/DeviceEditor'
import useConnectionStore from '@/stores/connectionStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { KeymapEditor } from '@/features/keymap/editor/KeymapEditor'
import { Drawer } from '@/layout/Drawer'
import { SidebarInset, SidebarProvider } from '@/ui/sidebar'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { Toaster } from '@/ui/sonner'
import { Header } from '@/layout/Header'
import { FloatingToolbar } from '@/layout/toolbar/FloatingToolbar'
import { ToolDialogs } from '@/layout/toolbar/ToolDialogs'
import { ToolSearch } from '@/layout/toolbar/ToolSearch'
import { AutoLayoutResolver } from '@/features/firmware/AutoLayoutResolver'
import { DevicePreviewCapture } from '@/features/connection/DevicePreviewCapture'
import { ProfileRestoreManager } from '@/features/connection/ProfileRestoreManager'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { StartPage } from '@/features/connection/start-page/StartPage'
import useBuilderStore from '@/stores/builderStore'
import { CoachmarkTour } from '@/features/onboarding/CoachmarkTour'
import { UpdateNotification } from '@/components/UpdateNotification'
import { WhatsNewDialog } from '@/features/news/WhatsNewDialog'
import { TitleBar } from '@/layout/TitleBar'
import { isElectron as isElectronEnv } from '@/transport'
import { isCloudConfigured } from '@/lib/cloud/env'
import useAuthStore from '@/stores/authStore'
import useSyncStore from '@/stores/syncStore'
import useLicenseStore from '@/stores/licenseStore'
import { useConfigRuntimeSync } from '@/hooks/use-config-runtime-sync'
import { connectDemo } from '@/features/connection/demo/connectDemo'
import { connectTransport } from '@/features/connection/connectTransport'
import { categoryForFirmware } from '@/lib/adapterCategories'
import { SIDEBAR_STYLE } from '@/layout/sidebarStyle'
import { needsTitleBar, resolveLanding, type Landing } from '@/app/landing'
import { SyncOnboardingDialog } from '@/features/library/SyncOnboardingDialog'
import { ShareLinkHandler } from '@/features/community/ShareLinkHandler'

// Code-split the full-screen builder: it drags in Monaco (multi-MB), which
// otherwise lands in the entry chunk for users who never open the builder.
const Builder = lazy(() =>
    import('@/features/builder').then((m) => ({ default: m.Builder })),
)

function App(): JSX.Element {
    // pattern-check: skip — UI sweep, replace store-connection with store-service
    // Field-scoped selectors — a bare useConnectionStore() re-renders the app
    // shell (and the whole editor subtree) on every unrelated field change.
    const service = useConnectionStore((s) => s.service)
    const setLockState = useConnectionStore((s) => s.setLockState)
    const lockState = useConnectionStore((s) => s.lockState)
    const reset = undoRedoStore((s) => s.reset)

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
    // Follow the connected device: point the settings screen at whichever family
    // this firmware belongs to, resolved against the adapter registry rather than
    // a name table. A device with no declared family (the demo mock) leaves the
    // user's choice alone; disconnecting clears it back to "not chosen".
    useEffect(() => {
        if (!service) {
            setPreferredAdapterCategory(null)
            return
        }
        const category = categoryForFirmware(service.deviceInfo.firmware)
        if (category) setPreferredAdapterCategory(category)
    }, [service, setPreferredAdapterCategory])

    const isElectron = isElectronEnv()

    // Restore a signed-in session (and pick up a desktop sign-in deep link that
    // launched the app). Builds without a backend never load supabase-js.
    useEffect(() => {
        if (!isCloudConfigured()) return
        void useAuthStore.getState().init()
        useSyncStore.getState().start()
        void useLicenseStore.getState().init()
    }, [])

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
    const landing = resolveLanding({ builderOpen, service, lockState })

    // Pattern check: Dispatch Map (Tier 0) — applied — landing → screen table replaces the nested service.kind ternary; one entry per screen.
    const screens: Record<Landing, () => JSX.Element> = {
        builder: () => (
            <Suspense fallback={null}>
                <Builder />
            </Suspense>
        ),
        start: () => (
            <StartPage
                onTransportCreated={connectTransport}
                onDemoConnect={connectDemo}
            />
        ),
        unlock: () => <UnlockPanel layout="screen" />,
        devices: () => <DeviceEditor controls={service!.controls!} />,
        dongle: () => <DongleLanding />,
        keymap: () => (
            <SidebarProvider className="!min-h-0 h-full" style={SIDEBAR_STYLE}>
                <Drawer />
                <SidebarInset>
                    <Header center={<ToolSearch />} />
                    <AutoLayoutResolver />
                    <DevicePreviewCapture />
                    <ProfileRestoreManager />
                    <ToolDialogs />
                    {/* The floating toolbar overlays the board's top edge. */}
                    <div className="relative flex min-h-0 flex-1 flex-col">
                        <FloatingToolbar />
                        <ErrorBoundary>
                            <KeymapEditor />
                        </ErrorBoundary>
                    </div>
                </SidebarInset>
                <CoachmarkTour />
            </SidebarProvider>
        ),
    }

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div className="flex h-screen flex-col overflow-hidden">
                {/* The editor, the full-screen builder, and the start page each
                    own a header with an inline drag region + window controls;
                    the screens without one get the standalone drag bar. */}
                {needsTitleBar(landing) && <TitleBar />}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <ErrorBoundary>{screens[landing]()}</ErrorBoundary>
                </div>
            </div>
            <UpdateNotification />
            <WhatsNewDialog />
            <Toaster richColors position="top-center" />
            {isCloudConfigured() && <SyncOnboardingDialog />}
            {isCloudConfigured() && <ShareLinkHandler />}
            <UnlockPanel layout="card" />
            <LeaveGuardDialog />
        </ThemeProvider>
    )
}

export default App
