// Pattern check: no GoF pattern (-) — rejected — cached plan snapshot read by
// plain pure predicates; the compiled stage is the fallback, no abstraction.
//
// Who may use the builder. With a backend, the answer comes from the plans the
// server holds (see ./plan): the free plan's `builder` limit says whether the
// builder is free for everyone, and the user's effective limits say whether
// they have it. The last answer is cached for the badge and for activation,
// but the cache can never unlock the builder: "free for everyone" counts only
// when the server said so in this session, or when this build is compiled as a
// free stage. Once paid, the builder also needs the license owner's account
// (signed in, or last signed in when offline) and a verified device license.
import { isCloudConfigured } from '@/lib/cloud/env'

/** Dispatched on the window when the cached plan changes, so hooks in the SAME
 *  tab re-evaluate (the `storage` event only fires in OTHER tabs). */
export const ENTITLEMENTS_CHANGE_EVENT = 'remappr:entitlements-change'

export const PLAN_STORAGE_KEY = 'remappr.plan'

/** Lifecycle stage of the builder. `alpha`/`beta` are FREE for everyone; `ga`
 *  (general availability) is the paid premium feature. */
export type BuilderStage = 'alpha' | 'beta' | 'ga'

/**
 * The stage this build is compiled as. While `alpha` or `beta` the builder is
 * free for everyone when the server cannot be asked (offline, no backend).
 * With a backend online the server decides: setting the free plan's `builder`
 * limit to 0 starts charging at once. The release that follows must set this
 * to `ga`, so that being offline (or editing the cache) no longer means free.
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

/** What the server said about the free stage in this session (never read
 *  from the cache: a cached "free" could be written by anyone). */
let liveFreeBuilder: boolean | null = null

/** Cache what the server said and tell same-tab listeners. */
export function setPlanSnapshot(snapshot: PlanSnapshot): void {
    liveFreeBuilder = snapshot.freeBuilder
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

/** Whether the builder is free for everyone right now: the server's answer in
 *  this session, else the stage this build is compiled as. */
export function isBuilderFree(): boolean {
    if (!isCloudConfigured()) return BUILDER_STAGE !== 'ga'
    return liveFreeBuilder ?? BUILDER_STAGE !== 'ga'
}

function changed(): void {
    if (typeof window !== 'undefined')
        window.dispatchEvent(new Event(ENTITLEMENTS_CHANGE_EVENT))
}

/** The account of this device's verified builder license (the license store
 *  verifies it offline and reports here); null without one. */
let licenseOwner: string | null = null
/** The signed-in account, or the last one when offline (see authStore). */
let account: string | null = null

export function setBuilderLicense(owner: string | null): void {
    if (owner === licenseOwner) return
    licenseOwner = owner
    changed()
}

export function setBuilderAccount(id: string | null): void {
    if (id === account) return
    account = id
    changed()
}

export function hasBuilderLicense(): boolean {
    return licenseOwner !== null
}

/** A verified license held by the account that is signed in here. */
function ownsLicense(): boolean {
    return licenseOwner !== null && licenseOwner === account
}

/** Local dev builds (not tests, not production) always have the builder. */
function isDevBypass(): boolean {
    return import.meta.env.DEV && import.meta.env.MODE !== 'test'
}

/** The gate the builder entry and its mount read. */
export function hasBuilderAccess(): boolean {
    if (isDevBypass()) return true
    if (isBuilderFree()) return true
    // Paid: a purchase alone is not enough on this device; it needs a device
    // license (verified offline, see stores/licenseStore) owned by the account
    // signed in here.
    return ownsLicense()
}

/** Paid, and this device holds a license but no account owning it is signed
 *  in: the builder asks to sign in rather than to buy. */
export function needsBuilderSignIn(): boolean {
    return !isBuilderFree() && licenseOwner !== null && !ownsLicense()
}

/** The plan grants the builder but this device has no license yet. */
export function needsBuilderActivation(): boolean {
    const snapshot = getPlanSnapshot()
    return (
        !!snapshot &&
        !snapshot.freeBuilder &&
        snapshot.builder &&
        licenseOwner === null
    )
}

/** Why the builder is locked here, or null when it opens. */
export type BuilderLock = 'sign_in' | 'activate' | 'buy'

export function builderLock(): BuilderLock | null {
    if (hasBuilderAccess()) return null
    if (needsBuilderSignIn()) return 'sign_in'
    if (needsBuilderActivation()) return 'activate'
    return 'buy'
}
