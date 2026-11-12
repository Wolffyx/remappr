// Pattern check: no GoF pattern (-) — rejected — composition of existing views (preview, widget fields, generic part settings) over one display's document; kind labels a lookup table.
//
// What a device's displays show (display part design §5): per display part,
// a pixel-accurate preview of its pages, the widget list of the page in
// hand, and the part's own settings (brightness, invert, rotation, in
// sleep) through the generic part-setting rows. Edits go to `onChange` as
// the whole `displays` list; the caller stages and saves it like any other
// setting of the device. What the device could not take (an unknown value,
// a picture of the wrong size, more than it holds) shows on the widget.
import { JSX, useState } from 'react'
import {
    ArrowDown,
    ArrowUp,
    ChartNoAxesColumn,
    Clock,
    Hash,
    Image,
    Plus,
    Square,
    Star,
    Trash2,
    Type,
    type LucideIcon,
} from 'lucide-react'
import type { ConfigDisplay, ConfigScreenWidget } from '@firmware/config/types'
import type { ScreenPanel, ScreensApi } from '@firmware/service'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { SensorSettings } from '@/features/devices/inspector/SensorSettings'
import { SettingsSection } from '@/features/device/SettingRows'
import {
    clampWidget,
    defaultPage,
    displayOf,
    displayProblems,
    invertOf,
    logicalOf,
    newWidget,
    rotationOf,
    rowSettings,
    type WidgetKind,
    withDefaultPage,
    withDisplay,
    withPage,
} from './displayModel'
import { DisplayPreview } from './DisplayPreview'
import { usePreviewValues } from './usePreviewValues'
import { WidgetFields } from './WidgetFields'

const KINDS: readonly { kind: WidgetKind; label: string; icon: LucideIcon }[] =
    [
        { kind: 'text', label: 'Text', icon: Type },
        { kind: 'value', label: 'Value', icon: Hash },
        { kind: 'bar', label: 'Bar', icon: ChartNoAxesColumn },
        { kind: 'clock', label: 'Clock', icon: Clock },
        { kind: 'image', label: 'Picture', icon: Image },
        { kind: 'rect', label: 'Rectangle', icon: Square },
    ]
const KIND = new Map(KINDS.map((k) => [k.kind, k]))

/** A widget's one-line summary in the list. */
function summary(
    w: ConfigScreenWidget,
    labels: ReadonlyMap<string, string>,
): string {
    if (w.kind === 'text') return w.text ? `"${w.text}"` : 'empty'
    if (w.kind === 'value' || w.kind === 'bar')
        return labels.get(w.source ?? '') ?? w.source ?? ''
    if (w.kind === 'clock') return w.format === 'date' ? 'date' : 'time'
    if (w.kind === 'image')
        return w.image ? `${w.image.width} × ${w.image.height}` : 'no picture'
    return w.frame ? 'outline' : 'filled'
}

/** Does @p w reach past the panel widgets see? */
const pastEdge = (
    w: ConfigScreenWidget,
    panel: { width: number; height: number },
): boolean => w.x + w.w > panel.width || w.y + w.h > panel.height

function WidgetRow({
    w,
    labels,
    active,
    problems,
    note,
    disabled,
    onPick,
    onMove,
    onRemove,
    children,
}: {
    w: ConfigScreenWidget
    labels: ReadonlyMap<string, string>
    active: boolean
    problems: readonly string[]
    /** Allowed, but probably not meant (it reaches past the panel). */
    note?: string
    disabled: boolean
    onPick: () => void
    onMove: (by: -1 | 1) => void
    onRemove: () => void
    children: React.ReactNode
}): JSX.Element {
    const k = KIND.get(w.kind)
    const Icon = k?.icon ?? Square
    return (
        <li
            className={cn(
                'rounded-lg border border-border',
                active && 'border-primary/60 bg-primary/5',
                problems.length > 0 && 'border-destructive/60',
            )}
        >
            <div className="flex items-center gap-2 px-2.5 py-1.5">
                <button
                    type="button"
                    onClick={onPick}
                    aria-expanded={active}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs font-semibold">
                        {k?.label ?? w.kind}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                        {summary(w, labels)}
                    </span>
                    <span className="ml-auto font-mono text-caption text-muted-foreground">
                        {w.x},{w.y} {w.w}×{w.h}
                    </span>
                </button>
                {!disabled && (
                    <span className="flex items-center gap-0.5">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Move up"
                            onClick={() => onMove(-1)}
                        >
                            <ArrowUp className="size-3" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Move down"
                            onClick={() => onMove(1)}
                        >
                            <ArrowDown className="size-3" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Remove widget"
                            onClick={onRemove}
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    </span>
                )}
            </div>
            {problems.map((p) => (
                <p
                    key={p}
                    className="px-2.5 pb-1.5 text-caption text-destructive"
                >
                    {p}
                </p>
            ))}
            {note && (
                <p className="px-2.5 pb-1.5 text-caption text-warning">
                    {note}
                </p>
            )}
            {active && (
                <div className="border-t border-border px-2.5 py-2">
                    {children}
                </div>
            )}
        </li>
    )
}

function PageTabs({
    d,
    page,
    disabled,
    onPage,
    onChange,
}: {
    d: ConfigDisplay
    page: number
    disabled: boolean
    onPage: (i: number) => void
    onChange: (d: ConfigDisplay) => void
}): JSX.Element {
    const first = defaultPage(d)
    const add = (): void => {
        onChange({ ...d, pages: [...d.pages, { widgets: [] }] })
        onPage(d.pages.length)
    }
    const remove = (): void => {
        onChange({ ...d, pages: d.pages.filter((_, i) => i !== page) })
        onPage(Math.max(0, page - 1))
    }
    return (
        <div className="flex flex-wrap items-center gap-1">
            {d.pages.map((_, i) => (
                <button
                    key={i}
                    type="button"
                    onClick={() => onPage(i)}
                    aria-pressed={i === page}
                    className={cn(
                        'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold',
                        i === page
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {i === first && d.pages.length > 1 && (
                        <Star className="size-3 fill-current" />
                    )}
                    Page {i + 1}
                </button>
            ))}
            {!disabled && (
                <>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={add}
                        aria-label="Add a page"
                    >
                        <Plus className="size-3.5" />
                    </Button>
                    {d.pages.length > 1 && page !== first && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onChange(withDefaultPage(d, page))}
                        >
                            Show first
                        </Button>
                    )}
                    {d.pages.length > 1 && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={remove}
                            aria-label="Remove this page"
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    )}
                </>
            )}
        </div>
    )
}

function DisplayCard({
    screens,
    part,
    n,
    displays,
    problems,
    disabled,
    deviceName,
    onChange,
}: {
    screens: ScreensApi
    part: ScreenPanel
    n: number
    displays: readonly ConfigDisplay[]
    problems: ReadonlyMap<string, string[]>
    disabled: boolean
    deviceName: string
    onChange: (displays: ConfigDisplay[]) => void
}): JSX.Element {
    const d = displayOf(displays, part.part)
    const [pageIdx, setPageIdx] = useState(() => defaultPage(d))
    const [selected, setSelected] = useState(-1)
    const page = Math.min(pageIdx, d.pages.length - 1)
    const widgets = d.pages[page]?.widgets ?? []
    const panel = logicalOf(screens, part, d)
    const labels = new Map(screens.sources.map((s) => [s.name, s.label]))
    const values = usePreviewValues(deviceName)
    const set = (next: ConfigDisplay): void =>
        onChange(withDisplay(displays, next))
    const setWidgets = (ws: ConfigScreenWidget[]): void =>
        set(withPage(d, page, { ...d.pages[page], widgets: ws }))
    const patch = (i: number, p: Partial<ConfigScreenWidget>): void =>
        setWidgets(
            widgets.map((w, wi) =>
                wi === i
                    ? clampWidget({ ...w, ...p }, panel.width, panel.height)
                    : w,
            ),
        )
    const move = (i: number, by: -1 | 1): void => {
        const j = i + by
        if (j < 0 || j >= widgets.length) return
        const ws = [...widgets]
        ;[ws[i], ws[j]] = [ws[j], ws[i]]
        setWidgets(ws)
        setSelected(j)
    }
    const add = (kind: WidgetKind): void => {
        setWidgets([...widgets, newWidget(kind, panel.width, panel.height)])
        setSelected(widgets.length)
    }
    const specs = part.info.settings.filter((s) => !s.personality)
    return (
        <SettingsSection
            title={n > 1 ? `Display ${part.part}` : 'Display'}
            description={`${part.model} · ${panel.width} × ${panel.height} px`}
        >
            <PageTabs
                d={d}
                page={page}
                disabled={disabled}
                onPage={(i) => {
                    setPageIdx(i)
                    setSelected(-1)
                }}
                onChange={set}
            />
            <DisplayPreview
                screens={screens}
                width={part.width}
                height={part.height}
                rotation={rotationOf(part, d)}
                invert={invertOf(part, d)}
                page={d.pages[page]}
                values={values}
                selected={selected}
                onSelect={setSelected}
            />
            {widgets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    Nothing on this page yet: the device shows its own content
                    until a page has a widget.
                </p>
            )}
            <ul className="flex flex-col gap-1.5">
                {widgets.map((w, i) => (
                    <WidgetRow
                        key={i}
                        w={w}
                        labels={labels}
                        active={i === selected}
                        problems={
                            problems.get(`${part.part}/${page}/${i}`) ?? []
                        }
                        note={
                            pastEdge(w, panel)
                                ? `Reaches past the ${panel.width} × ${panel.height} panel: the device cuts it off.`
                                : undefined
                        }
                        disabled={disabled}
                        onPick={() => setSelected(i === selected ? -1 : i)}
                        onMove={(by) => move(i, by)}
                        onRemove={() => {
                            setWidgets(widgets.filter((_, wi) => wi !== i))
                            setSelected(-1)
                        }}
                    >
                        <WidgetFields
                            screens={screens}
                            w={w}
                            set={(p) => patch(i, p)}
                            disabled={disabled}
                            panel={panel}
                        />
                    </WidgetRow>
                ))}
            </ul>
            {!disabled && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            className="self-start"
                        >
                            <Plus className="size-3.5" />
                            Add widget
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {KINDS.map(({ kind, label, icon: Icon }) => (
                            <DropdownMenuItem
                                key={kind}
                                onSelect={() => add(kind)}
                            >
                                <Icon className="size-3.5" />
                                {label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {specs.length > 0 && (
                <div className="border-t border-border pt-2">
                    <SensorSettings
                        specs={specs}
                        procedures={part.info.procedures}
                        index={part.part}
                        settings={rowSettings(d.settings)}
                        disabled={disabled}
                        onChange={(settings) => set({ ...d, settings })}
                    />
                </div>
            )}
        </SettingsSection>
    )
}

/** Every display part's editor over the document's `displays`. */
export function DisplaysEditor({
    screens,
    parts,
    displays,
    disabled,
    deviceName,
    onChange,
}: {
    screens: ScreensApi
    parts: readonly ScreenPanel[]
    displays: readonly ConfigDisplay[]
    disabled: boolean
    deviceName: string
    onChange: (displays: ConfigDisplay[]) => void
}): JSX.Element {
    const problems = displayProblems(screens, displays)
    const general = problems.get('') ?? []
    return (
        <div className="flex flex-col gap-4">
            {general.map((p) => (
                <p key={p} className="text-xs text-destructive">
                    {p}
                </p>
            ))}
            {parts.map((part) => (
                <DisplayCard
                    key={part.part}
                    screens={screens}
                    part={part}
                    n={parts.length}
                    displays={displays}
                    problems={problems}
                    disabled={disabled}
                    deviceName={deviceName}
                    onChange={onChange}
                />
            ))}
        </div>
    )
}
