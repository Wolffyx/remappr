// Pattern check: no GoF pattern (-) — rejected — one pure function over the
// firmware's checkCompleteness and bundle, for the link's own target.
//
// Whether the firmware files a link generates can build on GitHub. A project
// that cannot (no controller, no pins…) still pushes, but every push then
// starts a GitHub build that fails; the GitHub panel says so up front.
import {
    buildProjectBundle,
    checkCompleteness,
    parseKeymap,
    WORKFLOW_PATHS,
} from '@firmware/config'
import type { LibraryEntry } from '@/lib/library/types'

export interface BuildCheck {
    /** What stops the target's project from building ([] when it builds). */
    blockers: string[]
    /** The target's project carries a workflow that builds it on GitHub. */
    ciBuild: boolean
}

/** Null when the link generates no firmware files (no target, not a keymap,
 *  or a document that does not parse: the sync reports that itself). */
export function buildCheck(
    entry: Pick<LibraryEntry, 'kind' | 'source'>,
    target: string | null,
): BuildCheck | null {
    if (!target || entry.kind !== 'remappr.keymap') return null
    let config
    try {
        config = parseKeymap(entry.source)
    } catch {
        return null
    }
    // Judge the link's target, whatever firmware the keyboard lists.
    const [verdict] = checkCompleteness({
        ...config,
        keyboard: { ...config.keyboard, firmware: [target] },
    })
    const blockers = (verdict?.issues ?? [])
        .filter((i) => i.level === 'error')
        .map((i) => i.message)
    const ciBuild = buildProjectBundle(config, target).files.some((f) =>
        WORKFLOW_PATHS.includes(f.filename),
    )
    return { blockers, ciBuild }
}
