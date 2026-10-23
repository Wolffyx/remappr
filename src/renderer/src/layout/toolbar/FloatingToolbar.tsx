// Pattern check: Strategy (Tier 1) — applied — one renderer per toolbar style behind a style → component map; all six read the same resolved tool list from useEditorTools.
//
// The editor's floating toolbar: the board's tools in a pill above the canvas.
// The user picks how it is laid out (Settings → Workspace → Toolbar):
//
//   labelled  every tool, icon over a short label, under group captions (default)
//   compact   every tool as an icon with a tooltip
//   groups    view toggles inline, the other groups as menus with descriptions
//   expand    group chips; a click opens that group's tools inside the bar
//   search    a find box inside the bar, then every tool as an icon
//   pinned    the user's pinned tools plus an "All tools" launcher
//
// Every style renders from the same `useEditorTools` list, so availability,
// on-state and actions are identical across them.
import {
    Fragment,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from 'react'
import {
    Check,
    ChevronDown,
    Cpu,
    Eye,
    HardDrive,
    LayoutGrid,
    Lightbulb,
    Pin,
    Search,
    Sparkles,
    X,
    type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { SideloadAction } from '@/features/firmware/SideloadAction'
import useUserSettingsStore, {
    type ToolbarStyle,
} from '@/stores/userSettingsStore'
import {
    useEditorTools,
    type EditorTool,
    type EditorToolGroup,
    type ToolGroupId,
} from './tools'

const GROUP_ICON: Record<ToolGroupId, LucideIcon> = {
    view: Eye,
    behaviors: Sparkles,
    lighting: Lightbulb,
    device: Cpu,
    firmware: HardDrive,
}

const ACTIVE = 'bg-primary/15 text-primary hover:bg-primary/20'
const SEP = 'mx-1 data-[orientation=vertical]:h-6'

// ── shared pieces ──────────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }): JSX.Element {
    return (
        <div
            role="toolbar"
            aria-label="Board tools"
            data-coach="tools"
            className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-xl border bg-card p-1 shadow-lg"
        >
            {children}
        </div>
    )
}

/** A tool's tooltip: name, then group and description. */
function ToolTip({
    tool,
    children,
}: {
    tool: EditorTool
    children: ReactNode
}): JSX.Element {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex">{children}</span>
            </TooltipTrigger>
            <TooltipContent>
                <p className="font-semibold">{tool.label}</p>
                <p className="opacity-75">{tool.reason ?? tool.description}</p>
            </TooltipContent>
        </Tooltip>
    )
}

function IconTool({ tool }: { tool: EditorTool }): JSX.Element {
    const Icon = tool.icon
    return (
        <ToolTip tool={tool}>
            <Button
                variant="ghost"
                size="icon"
                aria-label={tool.label}
                aria-pressed={tool.active}
                disabled={tool.disabled}
                onClick={tool.run}
                className={cn(tool.active && ACTIVE)}
            >
                <Icon />
            </Button>
        </ToolTip>
    )
}

/** Icon and label side by side — menus, chips, pinned tools. */
function InlineTool({ tool }: { tool: EditorTool }): JSX.Element {
    const Icon = tool.icon
    return (
        <Button
            variant="ghost"
            size="sm"
            aria-pressed={tool.active}
            disabled={tool.disabled}
            title={tool.reason}
            onClick={tool.run}
            className={cn('gap-1.5 font-medium', tool.active && ACTIVE)}
        >
            <Icon className="size-4" />
            {tool.label}
        </Button>
    )
}

/** Icon over a short label — the labelled bar. */
function StackedTool({ tool }: { tool: EditorTool }): JSX.Element {
    const Icon = tool.icon
    return (
        <ToolTip tool={tool}>
            <button
                type="button"
                aria-label={tool.label}
                aria-pressed={tool.active}
                disabled={tool.disabled}
                onClick={tool.run}
                className={cn(
                    'flex h-9 min-w-9 flex-col items-center justify-center gap-1 rounded-md px-1.5 text-meta font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
                    // Labels only while the slot fits them (see LabelledBar).
                    '@min-[64rem]:h-12 @min-[64rem]:min-w-14',
                    tool.active && ACTIVE,
                )}
            >
                <Icon className="size-4" />
                <span className="hidden @min-[64rem]:inline">
                    {tool.short ?? tool.label}
                </span>
            </button>
        </ToolTip>
    )
}

/** Sideload is per-format (one button per file kind the adapter accepts), so
 *  it renders its own buttons at the end of the firmware group. */
function FirmwareExtras({ group }: { group: EditorToolGroup }): JSX.Element {
    return group.id === 'firmware' ? <SideloadAction /> : <></>
}

const visible = (groups: EditorToolGroup[]): EditorToolGroup[] =>
    groups.filter((g) => g.tools.length > 0 || g.id === 'firmware')

// ── styles ─────────────────────────────────────────────────────────────────

/** Labels and captions show only while the bar's slot (between the layer pill
 *  and the zoom box, a size container) is wide enough for them; narrower, the
 *  bar shows icons with tooltips so it stays on one line. */
function LabelledBar({ groups }: { groups: EditorToolGroup[] }): JSX.Element {
    return (
        <Shell>
            {visible(groups).map((g, i) => (
                <Fragment key={g.id}>
                    {i > 0 && (
                        <Separator orientation="vertical" className={SEP} />
                    )}
                    <div className="flex flex-col items-center gap-0.5 px-0.5 pt-0.5">
                        <span className="eyebrow hidden @min-[64rem]:block">
                            {g.label}
                        </span>
                        <div className="flex items-center">
                            {g.tools.map((t) => (
                                <StackedTool key={t.id} tool={t} />
                            ))}
                            <FirmwareExtras group={g} />
                        </div>
                    </div>
                </Fragment>
            ))}
        </Shell>
    )
}

function CompactBar({ groups }: { groups: EditorToolGroup[] }): JSX.Element {
    return (
        <Shell>
            {visible(groups).map((g, i) => (
                <Fragment key={g.id}>
                    {i > 0 && (
                        <Separator orientation="vertical" className={SEP} />
                    )}
                    {g.tools.map((t) => (
                        <IconTool key={t.id} tool={t} />
                    ))}
                    <FirmwareExtras group={g} />
                </Fragment>
            ))}
        </Shell>
    )
}

function MenuItemBody({ tool }: { tool: EditorTool }): JSX.Element {
    const Icon = tool.icon
    return (
        <>
            <Icon className="mt-0.5 size-4 self-start" />
            <span className="flex min-w-0 flex-col">
                <span className="font-medium">{tool.label}</span>
                <span className="text-caption text-muted-foreground">
                    {tool.reason ?? tool.description}
                </span>
            </span>
            {tool.active && <Check className="ml-auto size-4 text-primary" />}
        </>
    )
}

function GroupMenu({ group }: { group: EditorToolGroup }): JSX.Element {
    const Icon = GROUP_ICON[group.id]
    const anyActive = group.tools.some((t) => t.active)
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn('gap-1.5 font-medium', anyActive && ACTIVE)}
                >
                    <Icon className="size-4" />
                    {group.label}
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
                {group.tools.map((t) => (
                    <DropdownMenuItem
                        key={t.id}
                        disabled={t.disabled}
                        onSelect={t.run}
                        className="items-start gap-2.5 py-2"
                    >
                        <MenuItemBody tool={t} />
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function GroupsBar({ groups }: { groups: EditorToolGroup[] }): JSX.Element {
    const [view, ...rest] = groups
    return (
        <Shell>
            {view.tools.map((t) => (
                <IconTool key={t.id} tool={t} />
            ))}
            <Separator orientation="vertical" className={SEP} />
            {visible(rest).map((g) =>
                g.tools.length === 1 ? (
                    <InlineTool key={g.id} tool={g.tools[0]} />
                ) : (
                    <Fragment key={g.id}>
                        {g.tools.length > 0 && <GroupMenu group={g} />}
                        <FirmwareExtras group={g} />
                    </Fragment>
                ),
            )}
        </Shell>
    )
}

function ExpandBar({ groups }: { groups: EditorToolGroup[] }): JSX.Element {
    const [open, setOpen] = useState<ToolGroupId | null>(null)
    return (
        <Shell>
            {visible(groups).map((g) => {
                const Icon = GROUP_ICON[g.id]
                const active = g.tools.find((t) => t.active)
                // A one-tool group has nothing to expand.
                if (g.tools.length === 1 && g.id !== 'firmware')
                    return <InlineTool key={g.id} tool={g.tools[0]} />
                if (open !== g.id)
                    return (
                        <Button
                            key={g.id}
                            variant="ghost"
                            size="sm"
                            onClick={(): void => setOpen(g.id)}
                            className="gap-1.5 font-medium"
                        >
                            <Icon className="size-4" />
                            {g.label}
                            <span
                                className={cn(
                                    'rounded-full px-1.5 text-caption leading-[18px] font-semibold',
                                    active
                                        ? 'bg-primary/15 text-primary'
                                        : 'bg-secondary text-muted-foreground',
                                )}
                            >
                                {active ? active.label : g.tools.length}
                            </span>
                        </Button>
                    )
                return (
                    <div
                        key={g.id}
                        className="flex items-center gap-0.5 rounded-lg bg-primary/10 p-0.5 ring-1 ring-primary/35"
                    >
                        <Button
                            size="sm"
                            onClick={(): void => setOpen(null)}
                            className="gap-1.5"
                            aria-label={`Close ${g.label}`}
                        >
                            <Icon className="size-4" />
                            {g.label}
                            <X className="size-3.5" />
                        </Button>
                        {g.tools.map((t) => (
                            <InlineTool key={t.id} tool={t} />
                        ))}
                        <FirmwareExtras group={g} />
                    </div>
                )
            })}
        </Shell>
    )
}

function SearchBar({ groups }: { groups: EditorToolGroup[] }): JSX.Element {
    const [query, setQuery] = useState('')
    const all = useMemo(() => groups.flatMap((g) => g.tools), [groups])
    const q = query.trim().toLowerCase()
    const hits = q
        ? all.filter((t) =>
              `${t.label} ${t.description} ${t.group}`
                  .toLowerCase()
                  .includes(q),
          )
        : []
    const pick = (t: EditorTool): void => {
        t.run()
        setQuery('')
    }
    return (
        <Shell>
            <div className="relative">
                <label className="flex h-8 w-56 items-center gap-2 rounded-md border bg-background px-2.5 text-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
                    <Search className="size-4 text-muted-foreground" />
                    <input
                        value={query}
                        onChange={(e): void => setQuery(e.target.value)}
                        onKeyDown={(e): void => {
                            if (e.key === 'Escape') setQuery('')
                            if (e.key === 'Enter' && hits[0]) pick(hits[0])
                        }}
                        placeholder="Find a tool"
                        aria-label="Find a tool"
                        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                </label>
                {q && (
                    <div className="absolute top-full left-0 z-30 mt-1.5 w-80 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                        {hits.length === 0 && (
                            <p className="px-2.5 py-2 text-sm text-muted-foreground">
                                No tool matches “{query}”.
                            </p>
                        )}
                        {hits.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                disabled={t.disabled}
                                onClick={(): void => pick(t)}
                                className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                            >
                                <MenuItemBody tool={t} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <Separator orientation="vertical" className={SEP} />
            {visible(groups).map((g, i) => (
                <Fragment key={g.id}>
                    {i > 0 && (
                        <Separator orientation="vertical" className={SEP} />
                    )}
                    {g.tools.map((t) => (
                        <IconTool key={t.id} tool={t} />
                    ))}
                    <FirmwareExtras group={g} />
                </Fragment>
            ))}
        </Shell>
    )
}

function LauncherItem({
    tool,
    pinned,
    onPin,
}: {
    tool: EditorTool
    pinned: boolean
    onPin: () => void
}): JSX.Element {
    return (
        <div className="group/item flex items-start rounded-md hover:bg-accent">
            <button
                type="button"
                disabled={tool.disabled}
                onClick={tool.run}
                className="flex min-w-0 flex-1 items-start gap-2.5 px-2 py-2 text-left text-sm disabled:opacity-50"
            >
                <MenuItemBody tool={tool} />
            </button>
            <button
                type="button"
                onClick={onPin}
                aria-label={
                    pinned ? `Unpin ${tool.label}` : `Pin ${tool.label}`
                }
                aria-pressed={pinned}
                className={cn(
                    'm-1.5 grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition-opacity hover:text-foreground',
                    pinned
                        ? 'text-primary hover:text-primary'
                        : 'opacity-40 group-hover/item:opacity-100',
                )}
            >
                <Pin className="size-3.5" />
            </button>
        </div>
    )
}

function PinnedBar({ groups }: { groups: EditorToolGroup[] }): JSX.Element {
    const pinnedIds = useUserSettingsStore((s) => s.pinnedTools)
    const togglePin = useUserSettingsStore((s) => s.togglePinnedTool)
    const all = groups.flatMap((g) => g.tools)
    const pinned = all.filter((t) => pinnedIds.includes(t.id))
    return (
        <Shell>
            {pinned.map((t) => (
                <InlineTool key={t.id} tool={t} />
            ))}
            {pinned.length > 0 && (
                <Separator orientation="vertical" className={SEP} />
            )}
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 font-medium data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
                    >
                        <LayoutGrid className="size-4" />
                        All tools
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="center"
                    className="grid w-[min(70rem,calc(100vw-2rem))] grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))] gap-1 p-2"
                >
                    {visible(groups).map((g) => (
                        <div key={g.id} className="flex flex-col gap-px">
                            <span className="px-2 pt-1 pb-1.5 eyebrow">
                                {g.label}
                            </span>
                            {g.tools.map((t) => (
                                <LauncherItem
                                    key={t.id}
                                    tool={t}
                                    pinned={pinnedIds.includes(t.id)}
                                    onPin={(): void => togglePin(t.id)}
                                />
                            ))}
                            {g.id === 'firmware' && (
                                <div className="flex px-1">
                                    <SideloadAction />
                                </div>
                            )}
                        </div>
                    ))}
                    <p className="col-span-full flex items-center gap-2 border-t px-2 pt-2 text-caption text-muted-foreground">
                        <Pin className="size-3.5" />
                        Pin a tool to keep it on the bar. Tools this device
                        can’t use are hidden.
                    </p>
                </PopoverContent>
            </Popover>
        </Shell>
    )
}

const STYLES: Record<
    ToolbarStyle,
    (p: { groups: EditorToolGroup[] }) => JSX.Element
> = {
    labelled: LabelledBar,
    compact: CompactBar,
    groups: GroupsBar,
    expand: ExpandBar,
    search: SearchBar,
    pinned: PinnedBar,
}

export function FloatingToolbar(): JSX.Element {
    const style = useUserSettingsStore((s) => s.toolbarStyle)
    const { groups } = useEditorTools()
    const Bar = STYLES[style] ?? LabelledBar
    const ref = useToolbarHeightVar()
    // Same top line as the layer pill (left) and the zoom box (right), with
    // room kept for both; a bar too wide for the gap wraps its groups.
    return (
        <div
            ref={ref}
            className="@container pointer-events-none absolute inset-x-52 top-3 z-20 flex justify-center"
        >
            <Bar groups={groups} />
        </div>
    )
}

/** Publishes the bar's bottom edge as `--toolbar-h` on the editor area, so the
 *  board's top-centre chips (heatmap scale, key test, layer peek) sit below
 *  the bar whatever its style or wrap. */
function useToolbarHeightVar(): RefObject<HTMLDivElement | null> {
    const ref = useRef<HTMLDivElement>(null)
    useLayoutEffect(() => {
        const el = ref.current
        const host = el?.parentElement
        if (!el || !host) return
        const sync = (): void =>
            host.style.setProperty(
                '--toolbar-h',
                `${el.offsetTop + el.offsetHeight}px`,
            )
        sync()
        const ro = new ResizeObserver(sync)
        ro.observe(el)
        return (): void => {
            ro.disconnect()
            host.style.removeProperty('--toolbar-h')
        }
    }, [])
    return ref
}
