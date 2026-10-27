// pattern-check: skip — one request handler: verify the old license, re-check
// the entitlement and the device, sign a fresh one or say revoked.
//
// POST { token }. No account session needed: the license itself is the
// credential. Replies { token } with fresh claims, or { revoked: true } when
// the entitlement ended (refund, dispute, lapsed subscription) or the device
// was deactivated; the app then drops its license.
import {
    adminClient,
    claimsFor,
    json,
    licenseState,
    preflight,
    readOwnLicense,
    signLicense,
} from '../_shared/license.ts'

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const { token } = (await req.json().catch(() => ({}))) as { token?: string }
    const claims = token ? readOwnLicense(token) : null
    if (!claims) return json({ error: 'bad_token' }, 400)

    const admin = adminClient()
    const state = await licenseState(admin, claims.sub, claims.dev)
    if (!state.entitled || !state.device_active) return json({ revoked: true })
    // Touches last_seen_at (the device is active, so this never adds one).
    const { error } = await admin.rpc('license_register_device', {
        p_user: claims.sub,
        p_device: claims.dev,
        p_machine: claims.mach,
        p_meta: {},
    })
    if (error) return json({ error: error.message }, 500)
    return json({
        token: signLicense(
            claimsFor(state, claims.sub, claims.dev, claims.mach),
        ),
    })
})
