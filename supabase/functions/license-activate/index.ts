// pattern-check: skip — one request handler: authenticate, prove the device,
// check the entitlement and the device limit, sign a license.
//
// POST { devicePublicKey, proof, ts, machineHash?, platform, label? }
// with the user's bearer token. The device proves it holds its key by signing
// `uid.dev.ts` (ts within 5 minutes). A real entitlement is required: the free
// stage does not count. Replies { token } or { error }.
import {
    adminClient,
    callerId,
    claimsFor,
    fromB64url,
    json,
    licenseState,
    preflight,
    sha256Hex,
    signLicense,
    verifyDeviceProof,
} from '../_shared/license.ts'

const SKEW_MS = 5 * 60 * 1000
const PLATFORMS = ['web', 'linux', 'windows', 'macos']
const HASH_RE = /^[0-9a-f]{64}$/

interface ActivateBody {
    devicePublicKey?: string
    proof?: string
    ts?: number
    machineHash?: string | null
    platform?: string
    label?: string
}

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const uid = await callerId(req)
    if (!uid) return json({ error: 'not_authenticated' }, 401)

    const body = (await req.json().catch(() => ({}))) as ActivateBody
    if (!body.devicePublicKey || !body.proof || typeof body.ts !== 'number')
        return json({ error: 'bad_request' }, 400)
    if (Math.abs(Date.now() - body.ts) > SKEW_MS)
        return json({ error: 'clock_skew' }, 400)
    if (!PLATFORMS.includes(body.platform ?? ''))
        return json({ error: 'bad_platform' }, 400)
    const mach = body.machineHash ?? null
    if (mach !== null && !HASH_RE.test(mach))
        return json({ error: 'bad_machine' }, 400)

    const spki = fromB64url(body.devicePublicKey)
    const dev = await sha256Hex(spki)
    const proven = await verifyDeviceProof(
        spki,
        `${uid}.${dev}.${body.ts}`,
        fromB64url(body.proof),
    ).catch(() => false)
    if (!proven) return json({ error: 'bad_proof' }, 400)

    const admin = adminClient()
    const state = await licenseState(admin, uid, dev)
    if (!state.entitled) return json({ error: 'not_entitled' }, 403)
    const { data: registered, error } = await admin.rpc(
        'license_register_device',
        {
            p_user: uid,
            p_device: dev,
            p_machine: mach,
            p_meta: { platform: body.platform, label: body.label ?? '' },
        },
    )
    if (error) return json({ error: error.message }, 500)
    if (!registered) return json({ error: 'device_limit' }, 409)

    return json({ token: signLicense(claimsFor(state, uid, dev, mach)) })
})
