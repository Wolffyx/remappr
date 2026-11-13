// Pattern check: no GoF pattern (-) — rejected — re-export shim; the helpers moved
// to the firmware-client lib, this keeps the local import path stable.
//
// The custom hold-tap / mod-morph editor metadata + diff helpers now live in the
// lib (@firmware/config editorFields) so the builder shares one source of truth.
// Re-exported here under the original path so the modal's imports are unchanged.
export {
    type Flavor,
    FLAVOR_LABELS,
    FLAVOR_OPTIONS,
    type HoldTapNumField,
    HOLD_TAP_NUM_FIELDS,
    type HoldTapFlagField,
    HOLD_TAP_FLAG_FIELDS,
    ALL_MODIFIERS,
    modifierLabel,
    featureSupported,
    toggleModifier,
    holdTapPatch,
    modMorphPatch,
} from '@firmware/config'
