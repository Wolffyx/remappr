// pattern-check: skip — one request handler: ping the database, report.
//
// GET (no auth) for the uptime monitor: 200 { ok, dbMs } when the database
// answers, 503 { ok: false } when it does not.
import { adminClient, json, preflight } from '../_shared/http.ts'

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const started = performance.now()
    const { error } = await adminClient().rpc('health')
    if (error) {
        console.error('[health] database', JSON.stringify(error))
        return json({ ok: false }, 503)
    }
    return json({ ok: true, dbMs: Math.round(performance.now() - started) })
})
