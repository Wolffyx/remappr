// pattern-check: skip — ambient declaration of a build-time constant.
/** The environment this build trusts signing keys for: production, staging,
 *  local, or '' (none). Set by scripts/backend-env.ts. */
declare const __REMAPPR_ENV__: string
/** Public signing keys this build trusts beyond the pinned ones (staging
 *  builds only; scripts/backend-env.ts). */
declare const __REMAPPR_EXTRA_KEYS__: {
    license: Record<string, string>
    package: Record<string, string>
}
