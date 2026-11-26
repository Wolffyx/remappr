// Pattern check: no GoF pattern (-) — rejected — re-export shim; the helpers moved
// to the firmware-client lib, this keeps the local import path stable.
//
// The config-blob timing/defaults editor metadata now lives in the lib
// (@firmware/config editorFields) so the app's device editors AND the builder's
// design-time sections share one source of truth. Re-exported here under the
// original path so the modal's imports are unchanged.
export {
    type TimingFieldKey,
    type TimingFieldDef,
    TIMING_FIELDS,
    fieldSupported,
    groupedTimingFields,
    partTimingFields,
    timingFieldsFor,
} from '@firmware/config'
