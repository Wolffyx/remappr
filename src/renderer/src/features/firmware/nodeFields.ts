// Pattern check: no GoF pattern (-) — rejected — re-export shim; the helpers live
// in the firmware-client lib, this keeps the local import path stable (mirrors
// conditionalFields.ts).
//
// The node-bus role / mode-A cluster editor metadata + validation now live in the
// lib (@firmware/config editorFields) so the app and the builder share one source
// of truth. Re-exported here under a local path so the modal's imports are stable.
export {
    ROLE_OPTIONS,
    FORWARD_MODE_OPTIONS,
    CLUSTER_UID_MAX_HEX,
    emptyClusterNode,
    clusterError,
} from '@firmware/config'
