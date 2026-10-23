// Pattern check: no GoF pattern (-) — rejected — presentational radiogroup of workspace
// cards bound to a store field; mirrors KeycapsSection, no abstraction warranted.
import { cn } from '@/lib/cn'
import useUserSettingsStore, {
    type WorkspaceMode,
} from '@/stores/userSettingsStore'
import { TOOLBAR_STYLE_OPTIONS } from '@/layout/toolbar/toolbarStyles'

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
        </div>
    )
}
