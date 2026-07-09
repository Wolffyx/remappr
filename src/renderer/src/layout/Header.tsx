// Pattern check: Observer (Tier 1) — extended — uses service.onPendingChangesChanged Observer instead of pub-sub bridge.
// pattern-check: skip — toolbar JSX rebuild to the redesign spec; no new abstraction
/* eslint-disable react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useState } from 'react'
import {
    BarChart3,
    Blocks,
    BookOpen,
    Flame,
    Gauge,
    Keyboard,
    Lightbulb,
    Redo2,
    Save,
    ScanLine,
    Sliders,
    Sparkles,
    Trash2,
    Undo2,
    Wifi,
    Zap,
} from 'lucide-react'
import { applySaveMode, isSaveModeManaged } from '@/lib/saveMode'
import { LoadStatsModal } from '@/features/keymap/keyboard/LoadStatsModal'
import { WirelessSettingsModal } from '@/features/firmware/WirelessSettingsModal'
import { AdvancedSettingsModal } from '@/features/firmware/AdvancedSettingsModal'
import useRgbSheetStore from '@/stores/rgbSheetStore'
import useAdvancedSheetStore from '@/stores/advancedSheetStore'
import useConfigStore from '@/stores/configStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import useBuilderStore from '@/stores/builderStore'
import { GitHubIcon } from '@/components/GitHubIcon'
import { DiscordIcon } from '@/components/DiscordIcon'
import { DISCORD_URL, DOCS_URL, REPO_URL } from '@/lib/constants'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import useHeatmapStore from '@/stores/heatmapStore'
import useLiveViewStore from '@/stores/liveViewStore'
import useKeyTestStore from '@/stores/keyTestStore'
import useLoadStatsStore from '@/stores/loadStatsStore'
import { Settings } from '../components/modals/Settings.tsx'
import { Download as DownloadModal } from '../components/modals/Download.tsx'
import { SidebarTrigger } from '@/ui/sidebar'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { FeatureGate } from '@/features/firmware/FeatureGate'
import { useFeatureAvailable } from '@/features/firmware/useFeatureAvailable'
import { LayoutSideloadAction } from '@/features/firmware/LayoutSideloadAction'
import { WindowControls } from '@/layout/WindowControls'

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

// pattern-check: skip — wrap toolbar buttons in capability gate, no abstraction
export function Header(): JSX.Element {
    const { service, setService, communication, disconnect } =
        useConnectionStore()
    const { undo, redo, canUndo, canRedo, reset } = undoRedoStore()

    const heatmapOn = useHeatmapStore((s) => s.enabled)
    const toggleHeatmap = useHeatmapStore((s) => s.toggle)
    const liveOn = useLiveViewStore((s) => s.enabled)
    const toggleLive = useLiveViewStore((s) => s.toggle)
    const keyTestOn = useKeyTestStore((s) => s.active)
    const toggleKeyTest = useKeyTestStore((s) => s.toggle)
    const setKeyTestActive = useKeyTestStore((s) => s.setActive)
    // Key test is gated on the hardware switch-matrix facade; if it vanishes
    // (e.g. reconnecting to a firmware without it) force the mode off, since the
    // toggle button is hidden and the overlay would otherwise stick on.
    const keyTestAvailable = useFeatureAvailable('keyTest')
    useEffect(() => {
        if (!keyTestAvailable && keyTestOn) setKeyTestActive(false)
    }, [keyTestAvailable, keyTestOn, setKeyTestActive])
    const loadOpen = useLoadStatsStore((s) => s.open)
    const setLoadOpen = useLoadStatsStore((s) => s.setOpen)

    const [unsaved, setUnsaved] = useState<boolean>(false)
    // One Save button for every saveable firmware, driven by the Auto-save
    // setting via the save-mode controller (lib/saveMode.ts — attached to
    // every saveable service at connect; mock 'none' and read-only views stay
    // unmanaged and get no save UI). Manual mode → Save/Discard (QMK-family
    // stages client-side, ZMK stages on-device); auto mode → the same button
    // is a pulsing Auto-save indicator (QMK-family writes through, ZMK
    // auto-commits debounced). Derived from the SETTING, not the service
    // proxy, so the UI flips in the same render as the switch. Undo/redo stay
    // for all (client-side edit history).
    const autosave = useUserSettingsStore((s) => s.autosave)
    const saveManaged = !!service && isSaveModeManaged(service)
    const showSaveControls = saveManaged && !autosave
    const autoSaveActive = saveManaged && autosave
    const [wirelessOpen, setWirelessOpen] = useState(false)
    const [advancedOpen, setAdvancedOpen] = useState(false)
    const rgbSheetOpen = useRgbSheetStore((s) => s.open)
    const toggleRgbSheet = useRgbSheetStore((s) => s.toggle)
    const setRgbSheetOpen = useRgbSheetStore((s) => s.setOpen)

    // ZMK has no runtime RGB-settings protocol — underglow/backlight are
    // compile-time only. Gate the toolbar trigger (and force the sheet shut)
    // when the active firmware target is ZMK. Other targets keep the button.
    const rgbUnsupported = useConfigStore(
        (s) => s.config?.meta.target === 'zmk',
    )

    // Only when the editor was reached via the builder's "Editor" handoff do we
    // offer a way back. A directly-connected device never shows this.
    const cameFromBuilder = useBuilderStore((s) => s.cameFromBuilder)
    const returnToBuilder = useBuilderStore((s) => s.returnToBuilder)
    useEffect((): void => {
        if (rgbUnsupported && rgbSheetOpen) setRgbSheetOpen(false)
    }, [rgbUnsupported, rgbSheetOpen, setRgbSheetOpen])

    // Dynamic entries + macros share one bottom-dock sheet (advancedSheetStore),
    // mutually exclusive with the RGB sheet. The two triggers open it at their
    // section: Sliders → dynamic (Tap Dance first), Sparkles → Macros.
    const advSheetOpen = useAdvancedSheetStore((s) => s.open)
    const advSection = useAdvancedSheetStore((s) => s.section)
    const openAdvSheet = useAdvancedSheetStore((s) => s.openAt)
    const setAdvSheetOpen = useAdvancedSheetStore((s) => s.setOpen)
    const openDynamicSheet = (): void => {
        setRgbSheetOpen(false)
        openAdvSheet('td')
    }
    const openMacroSheet = (): void => {
        setRgbSheetOpen(false)
        openAdvSheet('macros')
    }
    const dynActive = advSheetOpen && advSection !== 'macros'
    const macroActive = advSheetOpen && advSection === 'macros'

    useEffect(() => {
        if (!service) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setUnsaved(false)
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const pending = await service.refreshPendingChanges()
                if (!cancelled) setUnsaved(pending)
            } catch (e) {
                console.error('Failed to refresh pending changes', e)
            }
        })()
        const off = service.onPendingChangesChanged((pending) => {
            setUnsaved(pending)
        })
        return (): void => {
            cancelled = true
            off()
        }
    }, [service])

    const save = useCallback(async (): Promise<void> => {
        if (!service) return
        try {
            await service.commit()
        } catch (e) {
            console.error('Failed to save changes', e)
            // Adapters throw a descriptive reason (e.g. ZMK maps its
            // SaveChangesErrorCode); surface it so the user knows WHY.
            toast.error(
                e instanceof Error ? e.message : 'Failed to save changes',
            )
        }
    }, [service])

    const discard = useCallback(async (): Promise<void> => {
        if (!service) return
        try {
            await service.discardChanges()
        } catch (e) {
            console.error('Failed to discard changes', e)
            toast.error(`Failed to discard changes`)
        }

        reset()
        setService(service, communication ?? undefined)
    }, [service, communication, reset, setService])

    // Sync the live service's save-mode flag with the setting. No service
    // swap, no reconnect work — the controller flips in place. Turning auto ON
    // flushes staged edits first; on flush failure the setting reverts and the
    // edits stay staged.
    useEffect(() => {
        if (!service || !isSaveModeManaged(service)) return
        applySaveMode(service, autosave).catch((e: unknown) => {
            toast.error(
                e instanceof Error
                    ? e.message
                    : 'Failed to save staged changes',
            )
            useUserSettingsStore.getState().setAutosave(false)
        })
    }, [autosave, service])

    return (
        <header
            className="flex h-(--header-height) shrink-0 select-none items-center gap-1 border-b bg-card pl-2 transition-[width,height] ease-linear"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* ===== left: sidebar toggle + brand ===== */}
            <div className="flex items-center gap-1" style={noDrag}>
                <SidebarTrigger />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={disconnect}
                            className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-foreground transition-colors hover:bg-accent"
                        >
                            <span className="grid size-7 place-items-center rounded-md bg-[linear-gradient(150deg,var(--primary),color-mix(in_oklch,var(--primary)_65%,#000))] text-white">
                                <Keyboard className="size-4" />
                            </span>
                            <span className="text-[14.5px] font-bold">
                                Remappr
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Back to devices</p>
                    </TooltipContent>
                </Tooltip>
                {cameFromBuilder && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={returnToBuilder}
                                className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                                <Blocks className="size-4" />
                                Builder
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Back to Builder</p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>

            {/* draggable spacer */}
            <div className="h-full flex-1" />

            {/* ===== right: tool clusters + window controls ===== */}
            <div
                className="flex items-center gap-1 pr-1"
                data-coach="tools"
                style={noDrag}
            >
                {/* view group: heatmap · live · stats */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            data-active={heatmapOn}
                            className="data-[active=true]:bg-primary/20 data-[active=true]:text-primary"
                            onClick={toggleHeatmap}
                        >
                            <Flame aria-label="Heatmap" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Heatmap</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            data-active={liveOn}
                            className="data-[active=true]:bg-primary/20 data-[active=true]:text-primary"
                            onClick={toggleLive}
                        >
                            <Zap aria-label="Live view" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Live view</p>
                    </TooltipContent>
                </Tooltip>
                {/* Key test reads the hardware switch matrix (service.keyTest);
                    without that facade it'd silently fall back to OS events and
                    duplicate Live view, so gate it on the capability. */}
                <FeatureGate feature="keyTest">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                data-active={keyTestOn}
                                className="data-[active=true]:bg-primary/20 data-[active=true]:text-primary"
                                onClick={toggleKeyTest}
                            >
                                <ScanLine aria-label="Key test" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Key test</p>
                        </TooltipContent>
                    </Tooltip>
                </FeatureGate>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(): void => setLoadOpen(true)}
                        >
                            <BarChart3 aria-label="Typing load" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Typing load stats</p>
                    </TooltipContent>
                </Tooltip>
                <LoadStatsModal
                    opened={loadOpen}
                    onClose={(): void => setLoadOpen(false)}
                />

                <Separator
                    orientation="vertical"
                    className="mx-1 data-[orientation=vertical]:h-5"
                />

                {/* config group: flash · dynamic · macros · wireless · rgb · settings · github */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <DownloadModal />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Flash &amp; export config</p>
                    </TooltipContent>
                </Tooltip>
                <FeatureGate feature="dynamic">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={dynActive ? 'secondary' : 'ghost'}
                                size="icon"
                                disabled={!service}
                                onClick={openDynamicSheet}
                            >
                                <Sliders aria-label="Dynamic entries" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Dynamic Entries</p>
                        </TooltipContent>
                    </Tooltip>
                </FeatureGate>
                <FeatureGate feature="macros">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={macroActive ? 'secondary' : 'ghost'}
                                size="icon"
                                disabled={!service}
                                onClick={openMacroSheet}
                            >
                                <Sparkles aria-label="Macros" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Macros</p>
                        </TooltipContent>
                    </Tooltip>
                </FeatureGate>
                <FeatureGate feature="wireless">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!service}
                                onClick={(): void => setWirelessOpen(true)}
                            >
                                <Wifi aria-label="Wireless settings" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Wireless</p>
                        </TooltipContent>
                    </Tooltip>
                </FeatureGate>
                <WirelessSettingsModal
                    opened={wirelessOpen}
                    onClose={(): void => setWirelessOpen(false)}
                />
                <FeatureGate feature="advanced">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!service}
                                onClick={(): void => setAdvancedOpen(true)}
                            >
                                <Gauge aria-label="Advanced settings" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Advanced Mode</p>
                        </TooltipContent>
                    </Tooltip>
                </FeatureGate>
                <AdvancedSettingsModal
                    opened={advancedOpen}
                    onClose={(): void => setAdvancedOpen(false)}
                />
                {/* RGB lighting — opens the board-visible bottom sheet (device
                    controls when an RGB keyboard is connected, else the on-screen
                    simulation editor). Disabled when the target is ZMK (no runtime
                    RGB protocol). The sheet itself renders in KeymapEditor. */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={rgbSheetOpen ? 'secondary' : 'ghost'}
                            size="icon"
                            disabled={!service || rgbUnsupported}
                            onClick={(): void => {
                                setAdvSheetOpen(false)
                                toggleRgbSheet()
                            }}
                        >
                            <Lightbulb aria-label="RGB lighting" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>
                            {rgbUnsupported
                                ? 'RGB lighting not supported on ZMK'
                                : 'RGB lighting'}
                        </p>
                    </TooltipContent>
                </Tooltip>
                <FeatureGate feature="layoutSideloadable">
                    <LayoutSideloadAction />
                </FeatureGate>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <Settings />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Settings</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                            <a
                                href={REPO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="View source on GitHub"
                            >
                                <GitHubIcon className="h-4 w-4" />
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>GitHub Repository</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                            <a
                                href={DISCORD_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Join the Discord community"
                            >
                                <DiscordIcon className="h-4 w-4" />
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Discord Community</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                            <a
                                href={DOCS_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Open the documentation"
                            >
                                <BookOpen className="h-4 w-4" />
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Documentation</p>
                    </TooltipContent>
                </Tooltip>

                <Separator
                    orientation="vertical"
                    className="mx-1 data-[orientation=vertical]:h-5"
                />

                {/* history group: undo · redo · discard · save-pill */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!canUndo()}
                                onClick={undo}
                            >
                                <Undo2 aria-label="Undo" />
                            </Button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Undo</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!canRedo()}
                                onClick={redo}
                            >
                                <Redo2 aria-label="Redo" />
                            </Button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Redo</p>
                    </TooltipContent>
                </Tooltip>
                {showSaveControls && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={!unsaved}
                                    onClick={discard}
                                >
                                    <Trash2 aria-label="Discard" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Discard changes</p>
                        </TooltipContent>
                    </Tooltip>
                )}
                {(showSaveControls || autoSaveActive) && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                disabled={
                                    autoSaveActive || !unsaved || !service
                                }
                                onClick={save}
                                data-dirty={unsaved && !autoSaveActive}
                                data-autosave={autoSaveActive}
                                className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors data-[dirty=false]:border-border data-[dirty=false]:bg-secondary data-[dirty=false]:text-muted-foreground data-[dirty=true]:border-transparent data-[dirty=true]:bg-primary data-[dirty=true]:text-primary-foreground data-[autosave=true]:animate-pulse data-[autosave=true]:border-primary/40 data-[autosave=true]:bg-primary/10 data-[autosave=true]:text-primary disabled:cursor-default disabled:opacity-100"
                            >
                                <Save className="size-3.5" />
                                {autoSaveActive
                                    ? 'Auto-save'
                                    : unsaved
                                      ? 'Save'
                                      : 'Saved'}
                                {unsaved && !autoSaveActive && (
                                    <span className="size-1.5 rounded-full bg-current" />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>
                                {autoSaveActive
                                    ? 'Auto-save is on — every change is written to the keyboard immediately. Toggle it in Settings → Communication.'
                                    : 'Save keymap to keyboard'}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>

            {/* native window controls (Electron, non-mac) merged into the bar */}
            <WindowControls />
        </header>
    )
}
