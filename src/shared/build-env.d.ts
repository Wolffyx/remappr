// pattern-check: skip — ambient declaration of a build-time constant.
/** The environment this build trusts signing keys for: production, staging,
 *  local, or '' (none). Set by scripts/backend-env.ts. */
declare const __REMAPPR_ENV__: string
