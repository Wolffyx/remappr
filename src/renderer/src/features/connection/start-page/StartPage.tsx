// pattern-check: skip — UI shell, restyled to the design prototype; delegates to useConnection
// Pattern check: no GoF pattern (-) — rejected — news layouts slot into fixed spots on the page, one layout per spot; a lookup table would still need the per-spot placement.
import { useEffect } from 'react'
import { Download, Keyboard, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { Transport } from '@firmware'

import { Button } from '@/ui/button'
import { DownloadLatestButton } from '@/components/DownloadLatestButton'
import { APP_VERSION } from '@/lib/constants'
import { LicenseNoticeModal } from '@/components/modals/LicenseNoticeModal'
import { Settings } from '@/components/modals/Settings'
import { WindowControls } from '@/layout/WindowControls'
import { TrafficLightInset } from '@/layout/TrafficLightInset'
import { CommunityLinks } from '@/layout/toolbar/CommunityLinks'
import { useConnection } from '@/hooks/use-connection'
import { cn } from '@/lib/cn'
import useUserSettingsStore from '@/stores/userSettingsStore'
import useNewsStore from '@/stores/newsStore'
import { useNews } from '@/features/news/newsUi'
import { NewsBanner } from '@/features/news/NewsBanner'
import { NewsBell } from '@/features/news/NewsBell'
import { NewsChip } from '@/features/news/NewsChip'
import { NewsFeed } from '@/features/news/NewsFeed'
import { NewsRail } from '@/features/news/NewsRail'
import { NewsSpotlight } from '@/features/news/NewsSpotlight'
import { ReleaseNotesDialog } from '@/features/news/ReleaseNotesDialog'

const DRAG_REGION = { WebkitAppRegion: 'drag' } as React.CSSProperties
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

import { ConnectionStatusBanner } from './ConnectionStatusBanner'
import { ConfigReadyBanner } from './ConfigReadyBanner'
import { TransportSection } from './TransportSection'
import { FeatureCard } from './FeatureCard'
import { BuilderCard } from './BuilderCard'

// The hero's "works with" pill; the chip news layout takes its place.
const COMPAT_BADGE = (
    <div
        className="mb-5 inline-flex items-center gap-[7px] rounded-full border px-3 py-[5px] text-[12px] font-semibold text-primary"
        style={{
            background: 'color-mix(in oklch, var(--primary) 14%, transparent)',
            borderColor: 'color-mix(in oklch, var(--primary) 30%, transparent)',
        }}
    >
        <span className="size-[7px] rounded-full bg-primary" />
        QMK · VIA · ZMK compatible
    </div>
)

// pattern-check: skip mechanical return-type change on an existing prop (void → Promise<boolean>)
interface StartPageProps {
    onTransportCreated: (
        t: Transport,
        communication: 'serial' | 'ble' | 'hid',
    ) => Promise<boolean>
    onDemoConnect?: () => void | Promise<void>
}

export function StartPage({
    onTransportCreated,
    onDemoConnect,
}: StartPageProps): JSX.Element {
    const {
        transports,
        haveTransports,
        hasListableTransports,
        hasSimpleConnectOnly,
        devices,
        connectingDeviceId,
        refreshing,
        refresh,
        connect,
        simpleConnect,
        requestNew,
    } = useConnection(onTransportCreated)

    // Start-page news — layout and banner are picked in Settings → Start page.
    const newsStyle = useUserSettingsStore((s) => s.newsStyle)
    const pinnedBanner = useUserSettingsStore((s) => s.newsPinnedBanner)
    const refreshNews = useNewsStore((s) => s.refresh)
    const news = useNews()
    const showBanner = pinnedBanner || newsStyle === 'banner'
    const newsOn = newsStyle !== 'none' || showBanner
    useEffect(() => {
        if (newsOn) void refreshNews()
    }, [newsOn, refreshNews])

    if (!haveTransports) {
        return <ConnectionStatusBanner />
    }

    return (
        // Only the content below scrolls — the header carries the Electron drag
        // region and window controls, so it has to stay pinned.
        <div className="workbench-bg flex h-full flex-col overflow-hidden bg-background">
            {/* top hairline */}
            <div
                className="h-[3px] shrink-0"
                style={{
                    background:
                        'linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 70%, transparent), transparent)',
                }}
            />

            {/* header */}
            {/* header: brand · project links (centred) · settings. Same
                `1fr auto 1fr` grid as the editor header. */}
            <header
                className="relative z-[2] grid shrink-0 select-none grid-cols-[1fr_auto_1fr] items-center gap-2 py-5 pl-7 pr-2"
                style={DRAG_REGION}
            >
                <div className="flex items-center">
                    {/* clears macOS's native traffic lights; no-op elsewhere */}
                    <TrafficLightInset />
                    <div className="flex items-center gap-3" style={NO_DRAG}>
                        <span
                            className="grid size-[38px] place-items-center rounded-xl text-white"
                            style={{
                                background:
                                    'linear-gradient(150deg, var(--primary), color-mix(in oklch, var(--primary) 70%, #000))',
                            }}
                        >
                            <Keyboard size={22} />
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-[21px] font-extrabold tracking-tight">
                                Remappr
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                                v{APP_VERSION}
                            </span>
                        </div>
                    </div>
                </div>
                <CommunityLinks />
                <div
                    className="flex items-center gap-1 justify-self-end"
                    style={NO_DRAG}
                >
                    {newsStyle === 'inbox' && <NewsBell {...news} />}
                    <Settings />
                    {/* native window controls (Electron, non-mac) merged into
                        the bar so the start page is a single top bar. */}
                    <div className="ml-1 flex h-9 items-stretch">
                        <WindowControls />
                    </div>
                </div>
            </header>

            {showBanner && <NewsBanner pinned={news.pinned} />}
            <ReleaseNotesDialog {...news} />

            {/* scroll area — everything except the pinned header */}
            <div className="flex min-h-0 flex-1 flex-col overflow-auto">
                {/* hero + content */}
                <main className="relative z-[1] flex flex-1 flex-col items-center px-6 pb-16 pt-8">
                    <div className="fade-in mb-9 max-w-[560px] text-center">
                        {newsStyle === 'chip' ? (
                            <NewsChip {...news} fallback={COMPAT_BADGE} />
                        ) : (
                            COMPAT_BADGE
                        )}
                        <h1 className="mb-3 text-[40px] font-extrabold leading-[1.05] tracking-tight">
                            Configure Your Device
                        </h1>
                        <p className="text-[16px] leading-normal text-muted-foreground">
                            Connect your device to customize keymaps and
                            settings.
                        </p>
                    </div>

                    {/* the rail sits beside the main column and wraps under
                        it when the window is too narrow for both */}
                    <div
                        className={cn(
                            'flex w-full flex-wrap items-start justify-center gap-6',
                            newsStyle === 'rail'
                                ? 'max-w-[1084px]'
                                : 'max-w-[720px]',
                        )}
                    >
                        <div className="fade-in flex min-w-0 max-w-[720px] flex-[1_1_720px] flex-col">
                            {newsStyle === 'spotlight' && (
                                <NewsSpotlight {...news} />
                            )}
                            <ConfigReadyBanner />

                            <TransportSection
                                transports={transports}
                                devices={devices}
                                hasListableTransports={hasListableTransports}
                                hasSimpleConnectOnly={hasSimpleConnectOnly}
                                refreshing={refreshing}
                                connectingDeviceId={connectingDeviceId}
                                onRefresh={refresh}
                                onConnect={connect}
                                onSimpleConnect={simpleConnect}
                                onRequestNew={requestNew}
                            />

                            <BuilderCard />

                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <FeatureCard
                                    icon={Sparkles}
                                    title="Try Demo Mode"
                                    description="Explore Remappr with a simulated keyboard — no device required."
                                    action={
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                if (onDemoConnect) {
                                                    void onDemoConnect()
                                                    return
                                                }
                                                toast.info(
                                                    'Demo mode coming soon!',
                                                    {
                                                        description:
                                                            'This feature is currently under development.',
                                                    },
                                                )
                                            }}
                                        >
                                            Try Demo
                                        </Button>
                                    }
                                />
                                <FeatureCard
                                    icon={Download}
                                    title="Get the desktop app"
                                    description="Download the latest Remappr build for your operating system."
                                    action={<DownloadLatestButton />}
                                />
                            </div>
                            {newsStyle === 'feed' && <NewsFeed {...news} />}
                        </div>
                        {newsStyle === 'rail' && <NewsRail {...news} />}
                    </div>
                </main>

                <footer className="border-t border-border py-5 text-center text-[12.5px] text-muted-foreground">
                    <span>
                        &copy; {new Date().getFullYear()} — Remappr Contributors
                    </span>
                    {' · '}
                    <LicenseNoticeModal />
                </footer>
            </div>
        </div>
    )
}
