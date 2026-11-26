// pattern-check: skip — command palette composed from ui/command over the shared tool table
//
// The header's search: a field-shaped button that opens a palette over every
// tool (same table as the floating toolbar), the toolbar styles and the help
// links. "/" opens it from anywhere outside a text field, a dialog or a menu,
// except while typed keys are the input (live view, heatmap, key test); ⌘K
// stays the key editor's assign shortcut.
import { useEffect, useState } from 'react'
import { BookOpen, LayoutPanelTop, Search } from 'lucide-react'

import { GitHubIcon } from '@/components/GitHubIcon'
import { DiscordIcon } from '@/components/DiscordIcon'
import { DISCORD_URL, DOCS_URL, REPO_URL } from '@/lib/constants'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/ui/command'
import useUserSettingsStore from '@/stores/userSettingsStore'
import useHeatmapStore from '@/stores/heatmapStore'
import useLiveViewStore from '@/stores/liveViewStore'
import useKeyTestStore from '@/stores/keyTestStore'
import { useEditorTools } from './tools'
import { TOOLBAR_STYLE_OPTIONS } from './toolbarStyles'

const LINKS = [
    { label: 'Documentation', href: DOCS_URL, icon: BookOpen },
    { label: 'GitHub repository', href: REPO_URL, icon: GitHubIcon },
    { label: 'Discord community', href: DISCORD_URL, icon: DiscordIcon },
]

const isTyping = (t: EventTarget | null): boolean => {
    const el = t as HTMLElement | null
    return (
        !!el &&
        (el.tagName === 'INPUT' ||
            el.tagName === 'TEXTAREA' ||
            el.isContentEditable ||
            !!el.closest('[role="dialog"],[role="menu"],[role="listbox"]'))
    )
}

/** Live view, the heatmap and key test count the keys typed on the board. */
const keysAreInput = (): boolean =>
    useLiveViewStore.getState().enabled ||
    useHeatmapStore.getState().enabled ||
    useKeyTestStore.getState().active

export function ToolSearch(): JSX.Element {
    const [open, setOpen] = useState(false)
    const { groups } = useEditorTools()
    const setToolbarStyle = useUserSettingsStore((s) => s.setToolbarStyle)

    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
            if (isTyping(e.target) || keysAreInput()) return
            e.preventDefault()
            setOpen(true)
        }
        window.addEventListener('keydown', onKey)
        return (): void => window.removeEventListener('keydown', onKey)
    }, [])

    const run = (fn: () => void): void => {
        setOpen(false)
        fn()
    }

    return (
        <>
            <button
                type="button"
                onClick={(): void => setOpen(true)}
                className="flex h-8 w-[min(26rem,36vw)] items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                <Search className="size-4" />
                <span className="truncate">Search tools and settings</span>
                <kbd className="ml-auto rounded border px-1.5 font-mono text-caption">
                    /
                </kbd>
            </button>
            <CommandDialog
                open={open}
                onOpenChange={setOpen}
                title="Search tools and settings"
            >
                <CommandInput placeholder="Search tools, settings and help" />
                <CommandList>
                    <CommandEmpty>Nothing matches.</CommandEmpty>
                    {groups
                        .filter((g) => g.tools.length > 0)
                        .map((g) => (
                            <CommandGroup key={g.id} heading={g.label}>
                                {g.tools.map((t) => {
                                    const Icon = t.icon
                                    return (
                                        <CommandItem
                                            key={t.id}
                                            value={`${t.label} ${t.description} ${g.label}`}
                                            disabled={t.disabled}
                                            onSelect={(): void => run(t.run)}
                                        >
                                            <Icon />
                                            <span>{t.label}</span>
                                            <span className="ml-auto truncate text-caption text-muted-foreground">
                                                {t.description}
                                            </span>
                                        </CommandItem>
                                    )
                                })}
                            </CommandGroup>
                        ))}
                    <CommandGroup heading="Toolbar style">
                        {TOOLBAR_STYLE_OPTIONS.map((o) => (
                            <CommandItem
                                key={o.value}
                                value={`toolbar ${o.label} ${o.blurb}`}
                                onSelect={(): void =>
                                    run(() => setToolbarStyle(o.value))
                                }
                            >
                                <LayoutPanelTop />
                                <span>Toolbar: {o.label}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    <CommandGroup heading="Help">
                        {LINKS.map(({ label, href, icon: Icon }) => (
                            <CommandItem
                                key={href}
                                value={label}
                                onSelect={(): void =>
                                    run(() => window.open(href, '_blank'))
                                }
                            >
                                <Icon className="size-4" />
                                <span>{label}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    )
}
