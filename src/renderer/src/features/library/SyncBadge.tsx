// Pattern check: Dispatch Map (Tier 0) — applied — sync state → label, icon and
// tone; presentational only.
//
// A library entry's cloud state, beside its name. Local-only entries show
// nothing; a conflict is a button that opens the conflict dialog.
import type { LucideIcon } from 'lucide-react'
import { Cloud, CloudAlert, CloudOff, CloudUpload, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { LibraryEntry, LibrarySyncState } from '@/lib/library/types'

interface BadgeLook {
    label: string
    icon: LucideIcon
    tone: string
    title: string
}

const LOOK: Partial<Record<LibrarySyncState, BadgeLook>> = {
    synced: {
        label: 'Synced',
        icon: Cloud,
        tone: 'text-muted-foreground',
        title: 'Saved in your account',
    },
    pending: {
        label: 'Syncing',
        icon: CloudUpload,
        tone: 'text-muted-foreground',
        title: 'Changes are on their way to your account',
    },
    conflict: {
        label: 'Resolve',
        icon: CloudAlert,
        tone: 'text-destructive',
        title: 'Changed here and in the cloud',
    },
    over_quota: {
        label: 'Not synced',
        icon: CloudOff,
        tone: 'text-amber-600 dark:text-amber-400',
        title: 'Over your plan’s cloud limit; it stays on this device',
    },
    needs_builder: {
        label: 'Builder only',
        icon: Lock,
        tone: 'text-amber-600 dark:text-amber-400',
        title: 'Syncing boards you designed needs the builder',
    },
}

function lookOf(entry: LibraryEntry): BadgeLook | undefined {
    // A clean entry already in the cloud with unsent edits is on its way.
    if (entry.sync.state === 'synced' && entry.sync.dirty) return LOOK.pending
    return LOOK[entry.sync.state]
}

export function SyncBadge({
    entry,
    onResolve,
}: {
    entry: LibraryEntry
    onResolve?: () => void
}): JSX.Element | null {
    const look = lookOf(entry)
    if (!look) return null
    const Icon = look.icon
    const body = (
        <>
            <Icon className="size-3.5" /> {look.label}
        </>
    )
    const className = cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        look.tone,
    )
    if (entry.sync.state === 'conflict' && onResolve)
        return (
            <button
                type="button"
                title={look.title}
                onClick={onResolve}
                className={cn(className, 'hover:underline')}
            >
                {body}
            </button>
        )
    return (
        <span title={look.title} className={className}>
            {body}
        </span>
    )
}
