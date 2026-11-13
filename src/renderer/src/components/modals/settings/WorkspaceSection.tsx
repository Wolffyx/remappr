// Pattern check: no GoF pattern (-) — rejected — presentational radiogroups of workspace,
// toolbar and sidebar cards bound to store fields; option tables, no abstraction warranted.
import { cn } from '@/lib/cn'
import useUserSettingsStore, {
    type LayerListStyle,
    type LayoutPickerStyle,
    type SidebarStyle,
    type WorkspaceMode,
} from '@/stores/userSettingsStore'
import { TOOLBAR_STYLE_OPTIONS } from '@/layout/toolbar/toolbarStyles'
import { SwitchRow } from '@/ui/switch-row'

const WORKSPACES: {
    value: WorkspaceMode
    label: string
    blurb: string
    schematic: JSX.Element
}[] = [
    {
        value: 'workbench',
        label: 'Workbench',
        blurb: 'Edit the selected key in a sheet below the board.',
        schematic: (
            <div className="flex h-full w-full flex-col gap-1 p-1.5">
                <div className="flex-1 rounded bg-primary/25" />
                <div className="h-3 rounded bg-foreground/30" />
            </div>
        ),
    },
    {
        value: 'inspector',
        label: 'Inspector',
        blurb: 'A persistent panel on the right; the board reflows.',
        schematic: (
            <div className="flex h-full w-full gap-1 p-1.5">
                <div className="flex-1 rounded bg-primary/25" />
                <div className="w-3 rounded bg-foreground/30" />
            </div>
        ),
    },
    {
        value: 'command',
        label: 'Command',
        blurb: 'Assign with a ⌘K palette; a layer colour-rail on the left.',
        schematic: (
            <div className="flex h-full w-full gap-1 p-1.5">
                <div className="w-1.5 rounded bg-foreground/30" />
                <div className="flex-1 rounded bg-primary/25" />
            </div>
        ),
    },
]

const panel = 'rounded bg-foreground/30'
const accent = 'rounded bg-primary/40'

/** The sidebar choices (f12): each a pair of radio cards. */
const SIDEBAR_CHOICES: readonly {
    title: string
    hint: string
    options: readonly {
        value: string
        label: string
        blurb: string
        schematic: JSX.Element
    }[]
}[] = [
    {
        title: 'Style',
        hint: 'How the other devices show.',
        options: [
            {
                value: 'card',
                label: 'Card',
                blurb: 'The open device on a card, the others as icons under it.',
                schematic: (
                    <div className="flex h-full w-full gap-1 p-1.5">
                        <div className="flex w-10 flex-col gap-1">
                            <div className={`h-3 ${accent}`} />
                            <div className="flex gap-0.5">
                                <div className={`size-1.5 ${panel}`} />
                                <div className={`size-1.5 ${panel}`} />
                                <div className={`size-1.5 ${panel}`} />
                            </div>
                            <div className={`h-1.5 ${panel}`} />
                        </div>
                        <div className="flex-1 rounded bg-primary/15" />
                    </div>
                ),
            },
            {
                value: 'rail',
                label: 'Rail',
                blurb: 'Every device one click away on a rail of icons.',
                schematic: (
                    <div className="flex h-full w-full gap-1 p-1.5">
                        <div className="flex w-2 flex-col gap-0.5">
                            <div className={`size-2 ${accent}`} />
                            <div className={`size-2 ${panel}`} />
                            <div className={`size-2 ${panel}`} />
                        </div>
                        <div className="flex w-8 flex-col gap-1">
                            <div className={`h-1.5 ${panel}`} />
                            <div className={`h-1.5 ${accent}`} />
                            <div className={`h-1.5 ${panel}`} />
                        </div>
                        <div className="flex-1 rounded bg-primary/15" />
                    </div>
                ),
            },
        ],
    },
    {
        title: 'Physical layouts',
        hint: 'Shown only when a keyboard has more than one.',
        options: [
            {
                value: 'select',
                label: 'Select menu',
                blurb: "One line; the menu shows each layout's keys.",
                schematic: (
                    <div className="flex h-full w-full flex-col gap-1 p-1.5">
                        <div className="h-3 w-3/4 rounded border border-foreground/30" />
                        <div className={`h-1.5 w-1/2 ${accent}`} />
                        <div className={`h-1.5 w-2/3 ${panel}`} />
                    </div>
                ),
            },
            {
                value: 'list',
                label: 'List',
                blurb: 'Every layout as a row; hover one to preview it.',
                schematic: (
                    <div className="flex h-full w-full flex-col gap-1 p-1.5">
                        <div className={`h-2 ${accent}`} />
                        <div className={`h-2 ${panel}`} />
                        <div className={`h-2 ${panel}`} />
                    </div>
                ),
            },
        ],
    },
    {
        title: 'Layers',
        hint: 'How the layer list and the key-type legend share the space.',
        options: [
            {
                value: 'scroll',
                label: 'Scroll, fold legend',
                blurb: 'The list scrolls; the legend folds to one line.',
                schematic: (
                    <div className="flex h-full w-full flex-col gap-1 p-1.5">
                        <div className={`h-1.5 ${panel}`} />
                        <div className={`h-1.5 ${accent}`} />
                        <div className={`h-1.5 ${panel}`} />
                        <div className={`mt-auto h-1 w-1/3 ${panel}`} />
                    </div>
                ),
            },
            {
                value: 'full',
                label: 'Full list',
                blurb: 'Every layer shown, the legend open below.',
                schematic: (
                    <div className="flex h-full w-full flex-col gap-1 p-1.5">
                        <div className={`h-1.5 ${panel}`} />
                        <div className={`h-1.5 ${accent}`} />
                        <div className="mt-auto flex gap-0.5">
                            <div className={`size-1.5 ${panel}`} />
                            <div className={`size-1.5 ${panel}`} />
                            <div className={`size-1.5 ${panel}`} />
                        </div>
                    </div>
                ),
            },
        ],
    },
]

/** One radio card: name, schematic, one line of what it does. */
function ChoiceCard({
    active,
    onPick,
    label,
    blurb,
    schematic,
}: {
    active: boolean
    onPick: () => void
    label: string
    blurb: string
    schematic: JSX.Element
}): JSX.Element {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={active}
            onClick={onPick}
            className={cn(
                'flex cursor-pointer flex-col gap-3 rounded-xl border p-3 text-left transition-colors',
                active
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-foreground/30 hover:bg-accent/40',
            )}
        >
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{label}</span>
                {active && (
                    <span className="text-xs font-medium text-primary">
                        Selected
                    </span>
                )}
            </div>
            <div className="h-16 rounded-lg bg-accent/30">{schematic}</div>
            <p className="text-xs text-muted-foreground">{blurb}</p>
        </button>
    )
}

export function WorkspaceSection(): JSX.Element {
    const workspace = useUserSettingsStore((s) => s.workspace)
    const setWorkspace = useUserSettingsStore((s) => s.setWorkspace)
    const toolbarStyle = useUserSettingsStore((s) => s.toolbarStyle)
    const setToolbarStyle = useUserSettingsStore((s) => s.setToolbarStyle)
    const sidebarStyle = useUserSettingsStore((s) => s.sidebarStyle)
    const layoutPicker = useUserSettingsStore((s) => s.layoutPicker)
    const layerList = useUserSettingsStore((s) => s.layerList)
    const autoRail = useUserSettingsStore((s) => s.sidebarAutoRail)
    const foldToRail = useUserSettingsStore((s) => s.sidebarFoldToRail)
    const set = useUserSettingsStore.getState()
    const values = [sidebarStyle, layoutPicker, layerList]
    const setters = [
        (v: string): void => set.setSidebarStyle(v as SidebarStyle),
        (v: string): void => set.setLayoutPicker(v as LayoutPickerStyle),
        (v: string): void => set.setLayerList(v as LayerListStyle),
    ]

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">Workspace</h3>
                    <p className="text-sm text-muted-foreground">
                        How you assign actions to keys.
                    </p>
                </div>
                <div
                    role="radiogroup"
                    aria-label="Workspace"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                >
                    {WORKSPACES.map(({ value, label, blurb, schematic }) => (
                        <ChoiceCard
                            key={value}
                            active={workspace === value}
                            onPick={(): void => setWorkspace(value)}
                            label={label}
                            blurb={blurb}
                            schematic={schematic}
                        />
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">Toolbar</h3>
                    <p className="text-sm text-muted-foreground">
                        How the tools above the board are laid out. Search with
                        “/” finds any tool in every style.
                    </p>
                </div>
                <div
                    role="radiogroup"
                    aria-label="Toolbar style"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                >
                    {TOOLBAR_STYLE_OPTIONS.map(
                        ({ value, label, blurb, schematic }) => (
                            <ChoiceCard
                                key={value}
                                active={toolbarStyle === value}
                                onPick={(): void => setToolbarStyle(value)}
                                label={
                                    value === 'labelled'
                                        ? `${label} (default)`
                                        : label
                                }
                                blurb={blurb}
                                schematic={schematic}
                            />
                        ),
                    )}
                </div>
            </div>
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">Sidebar</h3>
                    <p className="text-sm text-muted-foreground">
                        How devices, layouts and layers sit on the left. With
                        one device there is no device switcher.
                    </p>
                </div>
                {SIDEBAR_CHOICES.map((choice, i) => (
                    <div key={choice.title} className="space-y-2">
                        <div>
                            <div className="text-sm font-semibold">
                                {choice.title}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {choice.hint}
                            </p>
                        </div>
                        <div
                            role="radiogroup"
                            aria-label={`Sidebar ${choice.title.toLowerCase()}`}
                            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                        >
                            {choice.options.map((o) => (
                                <ChoiceCard
                                    key={o.value}
                                    active={values[i] === o.value}
                                    onPick={(): void => setters[i](o.value)}
                                    label={o.label}
                                    blurb={o.blurb}
                                    schematic={o.schematic}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                <div>
                    <SwitchRow
                        boxed
                        label="Use the rail when the card runs out of room"
                        hint="More than five devices: a dongle's nodes each count."
                        checked={autoRail}
                        onChange={set.setSidebarAutoRail}
                    />
                    <SwitchRow
                        boxed
                        className="mt-2"
                        label="Fold the panel to the rail"
                        hint="Layers and profiles show as numbers on the rail."
                        checked={foldToRail}
                        onChange={set.setSidebarFoldToRail}
                    />
                </div>
            </div>
        </div>
    )
}
