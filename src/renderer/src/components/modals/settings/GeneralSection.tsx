// Pattern check: no GoF pattern (-) — rejected — presentational settings section
// (theme swatch grid + segmented dark-mode + reused pickers) bound to stores; no
// abstraction warranted.
//
// General settings, matched to the design prototype's SettingsDialog "General"
// pane: an Appearance group (8-theme swatch grid + segmented
// light/dark/system) and a Keymap Display group (key header + colour-coding).
import { Segmented } from '@/ui/segmented'
import { KeyDisplayModePicker } from '@/components/KeyDisplayModePicker'
import { ColorCodingPicker } from '@/components/ColorCodingPicker'
import {
    THEME_NAMES,
    type Theme,
    type ThemeName,
    useTheme,
} from '@/providers/ThemeProvider'

// Display names for the swatch grid. Each swatch scopes its palette with
// data-palette, so its colours come from themes.css, never a copied list.
const THEME_LABEL: Record<ThemeName, string> = {
    default: 'Default',
    claude: 'Claude',
    supabase: 'Supabase',
    't3-chat': 'T3 Chat',
    vercel: 'Vercel',
    twitter: 'Twitter',
    bubblegum: 'Bubblegum',
    catppuccin: 'Catppuccin',
}

const DARK_MODES: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
]

/** A label + description on the left, control on the right, bottom border. */
function Row({
    label,
    desc,
    children,
}: {
    label: string
    desc?: string
    children: React.ReactNode
}): JSX.Element {
    return (
        <div className="flex items-center justify-between gap-5 border-b border-border py-3.5">
            <div>
                <div className="text-sm font-semibold">{label}</div>
                {desc && (
                    <div className="mt-0.5 text-control text-muted-foreground">
                        {desc}
                    </div>
                )}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    )
}

export function GeneralSection(): JSX.Element {
    const { theme, setTheme, themeName, setThemeName } = useTheme()

    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-1 text-lg font-bold tracking-tight">
                    Appearance
                </h3>
                {/* One way to pick the theme: the swatch grid (the old
                    dropdown beside it set the same value). */}
                <div className="border-b border-border py-3.5">
                    <div className="text-sm font-semibold">Theme</div>
                    <div className="mt-0.5 text-control text-muted-foreground">
                        Choose a colour theme — light & dark variants included
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                        {THEME_NAMES.map((name) => {
                            const active = themeName === name
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => setThemeName(name)}
                                    className="flex items-center gap-2 rounded-md p-1.5 text-left"
                                    style={{
                                        background: active
                                            ? 'color-mix(in oklab, var(--primary) 12%, transparent)'
                                            : 'var(--secondary)',
                                        border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                                    }}
                                >
                                    <span
                                        data-palette={name}
                                        className="relative size-[22px] shrink-0 rounded-md border border-border bg-background"
                                    >
                                        <span className="absolute inset-1 rounded-[3px] bg-primary" />
                                    </span>
                                    <span className="truncate text-xs font-semibold">
                                        {THEME_LABEL[name]}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
                <Row label="Dark Mode" desc="Light, dark, or follow the system">
                    <Segmented
                        value={theme}
                        options={DARK_MODES}
                        onChange={setTheme}
                    />
                </Row>
            </div>

            <div>
                <h3 className="mb-1 text-lg font-bold tracking-tight">
                    Keymap Display
                </h3>
                <Row
                    label="Key Header"
                    desc="Show the action name (Key Press) or binding code (&kp)"
                >
                    <KeyDisplayModePicker />
                </Row>
                <Row
                    label="Colour-coding"
                    desc="Tint keys by their function group"
                >
                    <ColorCodingPicker />
                </Row>
            </div>
        </div>
    )
}
