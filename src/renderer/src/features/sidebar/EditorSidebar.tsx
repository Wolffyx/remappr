// Pattern check: no GoF pattern (-) — rejected — one shell that picks card, rail or folded from the settings and the device count, then lays out the shared slots.
//
// One sidebar skeleton for every device (f12): the open device on top (a card
// with an icon strip, or a rail of every device), then the device's own
// content (layout select + layers for a keyboard, profiles for the others),
// then the legend, then the connection footer.
import {
    useCallback,
    useEffect,
    useState,
    type CSSProperties,
    type JSX,
    type ReactNode,
} from 'react'
import { ChevronDown, ChevronRight, PanelLeftClose } from 'lucide-react'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
} from '@/ui/sidebar'
import { DeviceMenu } from '@/features/connection/device-menu/DeviceMenu'
import { TrafficLightInset } from '@/layout/TrafficLightInset'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { DeviceCard, type DeviceIdentity } from './DeviceCard'
import { DevicePicker } from './DevicePicker'
import { DeviceRail, type FoldItem } from './DeviceRail'
import { useDeviceRoster } from './useDeviceRoster'
import { STRIP_MAX } from './roster'

type SidebarMode = 'single' | 'card' | 'rail' | 'folded'

const PANEL_WIDTH = '15.5rem'
const RAIL_WIDTH = '3.25rem'

const WIDTH: Readonly<Record<SidebarMode, string>> = {
    single: PANEL_WIDTH,
    card: PANEL_WIDTH,
    rail: `calc(${PANEL_WIDTH} + ${RAIL_WIDTH})`,
    folded: RAIL_WIDTH,
}

export const GROUP_LABEL =
    'text-caption font-bold tracking-[0.08em] text-muted-foreground uppercase'

/** Which layout the sidebar takes: one device never shows a switcher. */
function useSidebarMode(deviceCount: number): SidebarMode {
    const style = useUserSettingsStore((s) => s.sidebarStyle)
    const autoRail = useUserSettingsStore((s) => s.sidebarAutoRail)
    const fold = useUserSettingsStore((s) => s.sidebarFoldToRail)
    if (deviceCount < 2) return 'single'
    // The card holds STRIP_MAX icons; past that, auto-rail takes over.
    const rail = style === 'rail' || (autoRail && deviceCount > STRIP_MAX)
    if (!rail) return 'card'
    return fold ? 'folded' : 'rail'
}

/** ⌘⇧D (Ctrl+Shift+D) opens the device picker from anywhere in the editor. */
function usePickerShortcut(open: () => void): void {
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return
            if (e.key.toLowerCase() !== 'd') return
            e.preventDefault()
            open()
        }
        window.addEventListener('keydown', onKey)
        return (): void => window.removeEventListener('keydown', onKey)
    }, [open])
}

/** The legend under the list; folds to one line in the scrolling-list style. */
function LegendGroup({
    label,
    children,
}: {
    label: string
    children: ReactNode
}): JSX.Element {
    const foldable = useUserSettingsStore((s) => s.layerList === 'scroll')
    const [open, setOpen] = useState(false)
    const shown = !foldable || open
    const Chevron = shown ? ChevronDown : ChevronRight
    return (
        <SidebarGroup className="mt-auto shrink-0">
            {foldable ? (
                <button
                    type="button"
                    onClick={(): void => setOpen(!open)}
                    aria-expanded={shown}
                    className="flex items-center gap-1.5 border-t border-sidebar-border px-2 pt-2.5 pb-1.5 text-muted-foreground hover:text-foreground"
                >
                    <Chevron className="size-3.5" />
                    <span className={GROUP_LABEL}>{label}</span>
                </button>
            ) : (
                <div className={`${GROUP_LABEL} px-2 pb-1.5`}>{label}</div>
            )}
            {shown && <SidebarGroupContent>{children}</SidebarGroupContent>}
        </SidebarGroup>
    )
}

export interface EditorSidebarProps {
    identity: DeviceIdentity
    /** Under the device: the keyboard's layout select. */
    header?: ReactNode
    /** The device's own groups: layers, or profiles. */
    children: ReactNode
    legend: { label: string; body: ReactNode }
    /** The layers (or profiles) as numbers for the folded rail. */
    foldItems?: readonly FoldItem[]
}

/** The editor sidebar every device shares. */
export function EditorSidebar({
    identity,
    header,
    children,
    legend,
    foldItems = [],
}: EditorSidebarProps): JSX.Element {
    const { entries, refresh } = useDeviceRoster()
    const mode = useSidebarMode(entries.length)
    const setFold = useUserSettingsStore((s) => s.setSidebarFoldToRail)
    const [pickerOpen, setPickerOpen] = useState(false)
    const openPicker = useCallback((): void => {
        refresh()
        setPickerOpen(true)
    }, [refresh])
    usePickerShortcut(openPicker)

    const panel = (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SidebarContent className="pt-2">
                <TrafficLightInset variant="block" />
                <SidebarGroup className="shrink-0">
                    {mode === 'rail' ? (
                        <div className="flex items-start gap-1 px-1 pb-1">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[14px] font-bold">
                                    {identity.name}
                                </div>
                                <div className="text-caption text-muted-foreground">
                                    {identity.summary}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={(): void => setFold(true)}
                                aria-label="Fold the panel to the rail"
                                title="Fold the panel to the rail"
                                className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                            >
                                <PanelLeftClose className="size-3.5" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className={`${GROUP_LABEL} px-2 pb-1.5`}>
                                Device
                            </div>
                            <DeviceCard
                                identity={identity}
                                entries={mode === 'card' ? entries : undefined}
                                onOpenPicker={openPicker}
                            />
                        </>
                    )}
                    {header}
                </SidebarGroup>
                {children}
                <LegendGroup label={legend.label}>{legend.body}</LegendGroup>
            </SidebarContent>
            <SidebarFooter>
                <DeviceMenu />
            </SidebarFooter>
        </div>
    )

    return (
        <div
            className="contents"
            style={{ '--sidebar-width': WIDTH[mode] } as CSSProperties}
        >
            <Sidebar collapsible="offcanvas" variant="sidebar">
                <div className="flex h-full min-h-0">
                    {(mode === 'rail' || mode === 'folded') && (
                        <DeviceRail
                            entries={entries}
                            onOpenPicker={openPicker}
                            fold={
                                mode === 'folded'
                                    ? {
                                          items: foldItems,
                                          onExpand: () => setFold(false),
                                      }
                                    : undefined
                            }
                        />
                    )}
                    {mode !== 'folded' && panel}
                </div>
            </Sidebar>
            <DevicePicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                entries={entries}
            />
        </div>
    )
}
