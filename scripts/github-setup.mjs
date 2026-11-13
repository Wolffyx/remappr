// pattern-check: skip — one-shot CLI: copy .env.local values into GitHub.
//
//   node scripts/github-setup.mjs
//
// Sets what the workflows read, from .env.local (never printed):
// - environment "remappr", variables: the production and staging Supabase
//   URLs and publishable keys, and the staging public signing keys;
// - environments "supabase-staging" / "supabase-production", secret: the
//   project ref.
// All of these are public or near-public values. The one real secret,
// SUPABASE_ACCESS_TOKEN, is set separately with `gh secret set` (it prompts).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = 'Wolffyx/remappr'
const env = Object.fromEntries(
    readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const ref = (url) => {
    const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co/.exec(url ?? '')
    if (!m) throw new Error(`not a supabase.co project URL: ${url}`)
    return m[1]
}

const ENTRIES = [
    [
        'variable',
        'remappr',
        'VITE_SUPABASE_URL_PRODUCTION',
        env.PROD_SUPABASE_URL,
    ],
    [
        'variable',
        'remappr',
        'VITE_SUPABASE_PUBLISHABLE_KEY_PRODUCTION',
        env.PROD_SUPABASE_PUBLISHABLE_KEY,
    ],
    ['variable', 'remappr', 'VITE_SUPABASE_URL_STAGING', env.DEV_SUPABASE_URL],
    [
        'variable',
        'remappr',
        'VITE_SUPABASE_PUBLISHABLE_KEY_STAGING',
        env.DEV_SUPABASE_PUBLISHABLE_KEY,
    ],
    [
        'variable',
        'remappr',
        'SIGNING_PUBLIC_KEYS_STAGING',
        env.DEV_SIGNING_PUBLIC_KEYS,
    ],
    [
        'secret',
        'supabase-staging',
        'SUPABASE_PROJECT_REF_STAGING',
        ref(env.DEV_SUPABASE_URL),
    ],
    [
        'secret',
        'supabase-production',
        'SUPABASE_PROJECT_REF_PRODUCTION',
        ref(env.PROD_SUPABASE_URL),
    ],
]

for (const [kind, environment, name, value] of ENTRIES) {
    if (!value) throw new Error(`${name}: nothing for it in .env.local`)
    execFileSync(
        'gh',
        [kind, 'set', name, '--env', environment, '-R', REPO, '--body', value],
        { stdio: ['ignore', 'ignore', 'inherit'] },
    )
    console.log(`set ${kind} ${environment} / ${name}`)
}
console.log(
    'Now set SUPABASE_ACCESS_TOKEN in supabase-staging and supabase-production.',
)
