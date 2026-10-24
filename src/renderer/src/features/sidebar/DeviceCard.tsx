// Pattern check: no GoF pattern (-) — rejected — presentational card (name, summary, picker chevron) plus the capped icon strip; ordering lives in roster.ts.
import type { JSX } from 'react'
import { ChevronsUpDown, type LucideIcon } from 'lucide-react'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { DeviceIconButton } from './DeviceIconButton'
import { STRIP_MAX, stripOrder, type RosterEntry } from './roster'

export interface DeviceIdentity {
    name: string
    summary: string
    icon: LucideIcon
}

/** Up to STRIP_MAX device icons, then "+N" to open the picker. */
function DeviceStrip({
    entries,
    onMore,
}: {
    entries: readonly RosterEntry[]
    onMore: () => void
}): JSX.Element {
    const pinned = useUserSettingsStore((s) => s.pinnedDevices)
    const recent = useUserSettingsStore((s) => s.recentDevices)
    const ordered = stripOrder(entries, pinned, recent)
    const shown = ordered.slice(0, STRIP_MAX)
    const hidden = ordered.length - shown.length
    return (
        <div className="flex items-center gap-1 border-t border-primary/20 px-2 py-1.5">
            {shown.map((e) => (
                <DeviceIconButton key={e.key} entry={e} />
            ))}
            {hidden > 0 ? (
                <button
                    type="button"
                    onClick={onMore}
                    aria-label={`All ${ordered.length} devices`}
                    className="h-7 min-w-[34px] rounded-md border border-dashed border-sidebar-border px-1 font-mono text-caption font-bold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                    +{hidden}
                </button>
            ) : (
                <span className="ml-auto text-caption text-muted-foreground">
                    {ordered.length} devices
                </span>
            )}
        </div>
    )
}

/** The open device: icon, name and one summary line. The chevron opens the
 *  device picker; with several devices the strip below switches in one
 *  click. */
export function DeviceCard({
    identity,
    entries,
    onOpenPicker,
}: {
    identity: DeviceIdentity
    /** Omit to hide the strip (one device, or the rail shows them). */
    entries?: readonly RosterEntry[]
    onOpenPicker: () => void
}): JSX.Element {
    const Icon = identity.icon
    return (
        <div className="overflow-hidden rounded-lg border border-primary/30 bg-[color-mix(in_oklab,var(--primary)_12%,var(--sidebar))]">
            <button
                type="button"
                onClick={onOpenPicker}
                aria-label="Switch device"
                className="flex w-full items-center gap-2.5 px-[11px] py-2.5 text-left"
            >
                <Icon className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-panel-title font-bold">
                        {identity.name}
                    </span>
                    <span className="block text-caption leading-snug text-muted-foreground">
                        {identity.summary}
                    </span>
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
            {entries && <DeviceStrip entries={entries} onMore={onOpenPicker} />}
        </div>
    )
}
