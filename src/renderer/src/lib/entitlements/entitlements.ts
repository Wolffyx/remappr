// Pattern check: no GoF pattern (-) — rejected — cached plan snapshot read by
// plain pure predicates; the compiled stage is the fallback, no abstraction.
//
// Who may use the builder. With a backend, the answer comes from the plans the
// server holds (see ./plan): the free plan's `builder` limit says whether the
// builder is free for everyone, and the user's effective limits say whether
// they have it. The last answer is cached, so the gate works offline and on the
// first frame. A build without a backend uses the compiled BUILDER_STAGE.
import { isCloudConfigured } from '@/lib/cloud/env'

/** Dispatched on the window when the cached plan changes, so hooks in the SAME
 *  tab re-evaluate (the `storage` event only fires in OTHER tabs). */
export const ENTITLEMENTS_CHANGE_EVENT = 'remappr:entitlements-change'

export const PLAN_STORAGE_KEY = 'remappr.plan'

/** Lifecycle stage of the builder. `alpha`/`beta` are FREE for everyone; `ga`
 *  (general availability) is the paid premium feature. */
export type BuilderStage = 'alpha' | 'beta' | 'ga'

/**
 * The stage a build without a backend uses, and the label the free stage shows.
 * While `alpha` or `beta` the builder is free for everyone. With a backend the
 * server decides instead: setting the free plan's `builder` limit to 0 starts
 * charging, no release needed.
 */
const BUILDER_STAGE: BuilderStage = 'alpha'

/** What the server last said about the builder. */
export interface PlanSnapshot {
    /** The free plan grants the builder, so everyone has it. */
    freeBuilder: boolean
    /** The current user's effective plan grants the builder. */
    builder: boolean
}

function isPlanSnapshot(value: unknown): value is PlanSnapshot {
    const v = value as Partial<PlanSnapshot> | null
    return typeof v?.freeBuilder === 'boolean' && typeof v.builder === 'boolean'
}

/** The cached plan, or null with no backend or before the first fetch. */
export function getPlanSnapshot(): PlanSnapshot | null {
    if (!isCloudConfigured()) return null
    try {
        const raw = localStorage.getItem(PLAN_STORAGE_KEY)
        const parsed: unknown = raw ? JSON.parse(raw) : null
        return isPlanSnapshot(parsed) ? parsed : null
    } catch {
        // Storage blocked or a corrupt entry: behave as if nothing is cached.
        return null
    }
}

/** Cache what the server said and tell same-tab listeners. */
export function setPlanSnapshot(snapshot: PlanSnapshot): void {
    try {
        localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
        // Storage blocked: the answer lasts until reload, then falls back.
    }
    if (typeof window !== 'undefined')
        window.dispatchEvent(new Event(ENTITLEMENTS_CHANGE_EVENT))
}

/** The builder's current lifecycle stage (drives badge label + "free" copy). */
export function getBuilderStage(): BuilderStage {
    const snapshot = getPlanSnapshot()
    if (!snapshot) return BUILDER_STAGE
    if (!snapshot.freeBuilder) return 'ga'
    return BUILDER_STAGE === 'ga' ? 'beta' : BUILDER_STAGE
}

/** Whether the builder is free for everyone right now. */
export function isBuilderFree(): boolean {
    return getBuilderStage() !== 'ga'
}

let licenseValid = false

/** Whether this device holds a verified builder license (the license store
 *  verifies it offline and reports here). */
export function setBuilderLicenseValid(valid: boolean): void {
    if (valid === licenseValid) return
    licenseValid = valid
    if (typeof window !== 'undefined')
        window.dispatchEvent(new Event(ENTITLEMENTS_CHANGE_EVENT))
}

export function hasBuilderLicense(): boolean {
    return licenseValid
}

/** Local dev builds (not tests, not production) always have the builder. */
function isDevBypass(): boolean {
    return import.meta.env.DEV && import.meta.env.MODE !== 'test'
}

/** The gate the builder entry reads. */
export function hasBuilderAccess(): boolean {
    if (isDevBypass()) return true
    const snapshot = getPlanSnapshot()
    if (!snapshot) return isBuilderFree() || licenseValid
    // Paid stage: a purchase alone is not enough on this device; it needs a
    // device license, verified offline (see stores/licenseStore).
    return snapshot.freeBuilder || licenseValid
}

/** The plan grants the builder but this device has no license yet. */
export function needsBuilderActivation(): boolean {
    const snapshot = getPlanSnapshot()
    return (
        !!snapshot && !snapshot.freeBuilder && snapshot.builder && !licenseValid
    )
}
