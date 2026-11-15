// Pattern check: Dispatch Map (Tier 0) — applied — change ops map to a glyph
// and tone; the diff itself is the firmware's diffDocuments.
//
// What changed between two versions of a library document, grouped by area
// (bindings, layers, keys …). Personality-neutral: the firmware decides what
// the changes are; this only lists them.
import { useMemo } from 'react'
import {
    diffDocuments,
    type ChangeOp,
    type DocumentChange,
} from '@firmware/config'
import { parseDocument } from '@/lib/library/entries'
import type { LibraryDocKind } from '@/lib/library/types'

const OP: Record<ChangeOp, { glyph: string; className: string }> = {
    added: { glyph: '+', className: 'text-[var(--success)]' },
    removed: { glyph: '−', className: 'text-[var(--danger)]' },
    changed: { glyph: '~', className: 'text-[var(--warning)]' },
    moved: { glyph: '↔', className: 'text-[var(--info)]' },
}

/** 'tapDance' → 'Tap dance': the firmware's area ids, read as headings. */
function areaTitle(area: string): string {
    const words = area.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
    return words.charAt(0).toUpperCase() + words.slice(1)
}

function groupByArea(
    changes: readonly DocumentChange[],
): [string, DocumentChange[]][] {
    const groups = new Map<string, DocumentChange[]>()
    for (const c of changes)
        groups.set(c.area, [...(groups.get(c.area) ?? []), c])
    return [...groups]
}

function ChangeRow({ change }: { change: DocumentChange }): JSX.Element {
    const op = OP[change.op]
    return (
        <li className="flex gap-2 py-0.5 text-xs">
            <span
                className={`w-3 shrink-0 font-mono font-bold ${op.className}`}
            >
                {op.glyph}
            </span>
            <span className="min-w-0">
                <span className="font-medium">{change.label}</span>
                {(change.before || change.after) && (
                    <span className="text-muted-foreground">
                        {': '}
                        {change.before && (
                            <span className="line-through">
                                {change.before}
                            </span>
                        )}
                        {change.before && change.after && ' → '}
                        {change.after && (
                            <span className="text-foreground">
                                {change.after}
                            </span>
                        )}
                    </span>
                )}
            </span>
        </li>
    )
}

export interface VersionDiffProps {
    kind: LibraryDocKind
    before: string
    after: string
}

export function VersionDiff({
    kind,
    before,
    after,
}: VersionDiffProps): JSX.Element {
    const diff = useMemo(() => {
        const a = parseDocument(kind, before)
        const b = parseDocument(kind, after)
        return a && b ? diffDocuments(a, b) : null
    }, [kind, before, after])

    if (!diff)
        return (
            <p className="text-xs text-muted-foreground">
                One of these versions no longer opens, so there is no diff.
            </p>
        )
    if (diff.changes.length === 0)
        return <p className="text-xs text-muted-foreground">No changes.</p>
    return (
        <div className="space-y-3">
            <p className="text-xs font-semibold">{diff.summary}</p>
            {groupByArea(diff.changes).map(([area, changes]) => (
                <section key={area}>
                    <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {areaTitle(area)}
                    </h4>
                    <ul>
                        {changes.map((c) => (
                            <ChangeRow key={`${c.path}:${c.op}`} change={c} />
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    )
}
