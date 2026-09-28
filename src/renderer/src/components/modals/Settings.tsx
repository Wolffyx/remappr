// Pattern check: no GoF pattern (-) — rejected — UI restructure into sidemenu nav with sectioned panels; no class hierarchy or polymorphism warranted.
// pattern-check: skip — additive Cancel/Done snapshot-revert via refs + store setState
import { useEffect, useRef, useState } from 'react'
import {
    Info,
    Keyboard,
    LayoutPanelLeft,
    Newspaper,
    Palette,
    Radio,
    Settings as SettingsIcon,
} from 'lucide-react'
import { Modal } from '@/ui/modal'
import { ScrollArea } from '@/ui/scroll-area'
import { cn } from '@/lib/cn'
import useUserSettingsStore, {
    type CapStyle,
    type ColorCodingMode,
    type KeyDisplayMode,
    type NewsStyle,
    type WorkspaceMode,
} from '@/stores/userSettingsStore'
import { type Theme, type ThemeName, useTheme } from '@/providers/ThemeProvider'
import { GeneralSection } from './settings/GeneralSection'
import { KeycapsSection } from './settings/KeycapsSection'
import { WorkspaceSection } from './settings/WorkspaceSection'
import { StartPageSection } from './settings/StartPageSection'
import { CommunicationSection } from './settings/CommunicationSection'
import { AboutSection } from './settings/AboutSection'

// Settings the dialog can mutate — snapshotted on open so Cancel reverts them.
interface SettingsSnapshot {
    capStyle: CapStyle
    colorMode: ColorCodingMode
    workspace: WorkspaceMode
    newsStyle: NewsStyle
    newsPinnedBanner: boolean
    keyDisplayMode: Record<string, KeyDisplayMode>
    theme: Theme
    themeName: ThemeName
}

// Mounts only while the dialog is open (Radix unmounts content on close),
// so its mount effect fires once per open — the moment to snapshot.
function SnapshotOnOpen({ onOpen }: { onOpen: () => void }): null {
    useEffect(() => {
        onOpen()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return null
}

interface SettingsProps {
    opened?: boolean
    onClose?: () => void
    /** Limit which sections show (builder hides device-only "communication").
     *  Defaults to all. */
    sections?: Array<
        | 'general'
        | 'keycaps'
        | 'workspace'
        | 'start'
        | 'communication'
        | 'about'
    >
}

type SettingsSection =
    | 'general'
    | 'keycaps'
    | 'workspace'
    | 'start'
    | 'communication'
    | 'about'

const SECTIONS: {
    id: SettingsSection
    label: string
    icon: typeof Palette
}[] = [
    { id: 'general', label: 'General', icon: Palette },
    { id: 'keycaps', label: 'Keycaps', icon: Keyboard },
    { id: 'workspace', label: 'Workspace', icon: LayoutPanelLeft },
    { id: 'start', label: 'Start page', icon: Newspaper },
    { id: 'communication', label: 'Communication', icon: Radio },
    { id: 'about', label: 'About', icon: Info },
]

// pattern-check: skip — additive snapshot/revert refs; Memento considered, rejected as overkill
export function Settings({
    opened,
    onClose,
    sections,
}: SettingsProps): JSX.Element {
    const visibleSections = sections
        ? SECTIONS.filter((s) => sections.includes(s.id))
        : SECTIONS
    const [section, setSection] = useState<SettingsSection>(
        sections?.[0] ?? 'general',
    )
    const { theme, setTheme, themeName, setThemeName } = useTheme()
    const snapshotRef = useRef<SettingsSnapshot | null>(null)
    const committedRef = useRef(false)

    const takeSnapshot = (): void => {
        const s = useUserSettingsStore.getState()
        snapshotRef.current = {
            capStyle: s.capStyle,
            colorMode: s.colorMode,
            workspace: s.workspace,
            newsStyle: s.newsStyle,
            newsPinnedBanner: s.newsPinnedBanner,
            keyDisplayMode: { ...s.keyDisplayMode },
            theme,
            themeName,
        }
        committedRef.current = false
    }

    const revert = (): void => {
        const snap = snapshotRef.current
        if (!snap) return
        useUserSettingsStore.setState({
            capStyle: snap.capStyle,
            colorMode: snap.colorMode,
            workspace: snap.workspace,
            newsStyle: snap.newsStyle,
            newsPinnedBanner: snap.newsPinnedBanner,
            keyDisplayMode: snap.keyDisplayMode,
        })
        setTheme(snap.theme)
        setThemeName(snap.themeName)
    }

    const handleClose = (): void => {
        if (!committedRef.current) revert()
        onClose?.()
    }

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            onOk={() => {
                committedRef.current = true
            }}
            success="Done"
            close="Cancel"
            title="Settings"
            subtitle="Appearance, keycaps, workspace, start page & device"
            headerIcon={<SettingsIcon />}
            customModalBoxClass="w-11/14 max-w-4xl"
            type="icon"
            icon={<SettingsIcon />}
            variant="ghost"
        >
            <SnapshotOnOpen onOpen={takeSnapshot} />
            <div className="flex min-h-[28rem] gap-4">
                <aside className="w-48 shrink-0 border-r pr-2">
                    <nav className="flex flex-col gap-0.5">
                        {visibleSections.map(({ id, label, icon: Icon }) => {
                            const active = section === id
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setSection(id)}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                        active
                                            ? 'bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            )
                        })}
                    </nav>
                </aside>
                <ScrollArea className="max-h-[60vh] flex-1 pr-2">
                    {section === 'general' && <GeneralSection />}
                    {section === 'keycaps' && <KeycapsSection />}
                    {section === 'workspace' && <WorkspaceSection />}
                    {section === 'start' && <StartPageSection />}
                    {section === 'communication' && <CommunicationSection />}
                    {section === 'about' && <AboutSection />}
                </ScrollArea>
            </div>
        </Modal>
    )
}
