// Pattern check: no GoF pattern (-) — rejected — re-export shim; the helpers live
// in the firmware-client lib, this keeps the local import path stable (mirrors
// nodeFields.ts / conditionalFields.ts).
//
// The node-bus link/latency-profile editor metadata + validation (§8, N6) live in
// the lib (@firmware/config editorFields) so the app and the builder share one
// source of truth. Re-exported here under a local path so the modal's imports are
// stable.
export {
    LINK_PROFILE_OPTIONS,
    POWER_TIER_OPTIONS,
    LINK_KNOB_FIELDS,
    LINK_PROFILE_BASE,
    emptyLinkProfile,
    linkKnobValue,
    linkKnobRange,
    withLinkOverride,
    linkProfileError,
    type LinkKnobField,
} from '@firmware/config'
