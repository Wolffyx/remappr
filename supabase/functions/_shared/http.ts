// pattern-check: skip — small request helpers shared by every function.
//
// CORS * (bearer tokens, no cookies), the JSON reply, the service-role client
// and the caller's id from their bearer token.
import {
    createClient,
    type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.118.0'

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    })
}

/** Answer CORS preflight; null for a real request. */
export function preflight(req: Request): Response | null {
    return req.method === 'OPTIONS'
        ? new Response('ok', { headers: CORS })
        : null
}

export function adminClient(): SupabaseClient {
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        {
            auth: { persistSession: false },
        },
    )
}

/** The signed-in caller's user id, from the request's bearer token. The
 *  token is passed to getUser explicitly: a forwarded header alone is not
 *  read as a session, and hosted projects on the new API keys may have no
 *  legacy SUPABASE_ANON_KEY. A publishable key or junk is no user. */
export async function callerId(req: Request): Promise<string | null> {
    const token = /^Bearer\s+(\S+)$/i.exec(
        req.headers.get('Authorization') ?? '',
    )?.[1]
    // A user access token is a JWT (three dot-separated parts).
    if (!token || token.split('.').length !== 3) return null
    const { data, error } = await adminClient().auth.getUser(token)
    if (error) console.warn('[auth] caller not verified:', error.message)
    return data.user?.id ?? null
}
