// pattern-check: skip — barrel re-export of the entitlements public surface.
export {
    FEATURE_FLAGS,
    type FeatureFlag,
    isFeatureEnabled,
} from './featureFlags'
export {
    type BuilderStage,
    type PlanSnapshot,
    getBuilderStage,
    isBuilderFree,
    hasBuilderAccess,
    hasBuilderLicense,
    needsBuilderActivation,
    needsBuilderSignIn,
    builderLock,
    type BuilderLock,
    setBuilderAccount,
    setBuilderLicense,
    getPlanSnapshot,
    setPlanSnapshot,
    ENTITLEMENTS_CHANGE_EVENT,
    PLAN_STORAGE_KEY,
} from './entitlements'
export { refreshPlan } from './plan'
// `useBuilderAccess` is a React hook — it lives in hooks/use-premium.ts (lib/ is
// pure-logic only). Import it from '@/hooks/use-premium'.
