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

/** The signed-in caller's user id, from the request's bearer token. */
export async function callerId(req: Request): Promise<string | null> {
    const auth = req.headers.get('Authorization')
    if (!auth) return null
    const client = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        {
            global: { headers: { Authorization: auth } },
            auth: { persistSession: false },
        },
    )
    const { data } = await client.auth.getUser()
    return data.user?.id ?? null
}
