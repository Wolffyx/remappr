// Pattern check: Dispatch Map (Tier 0) — applied — command name maps to its handler, each acting on one backend target
//
//   pnpm backend                 which backend local runs use, and why
//   pnpm backend push <dev|prod>    apply supabase/migrations to that project
//   pnpm backend deploy <dev|prod>  deploy the Edge Functions there
//   pnpm backend keys <dev|prod> [--replace] [--backup-dir <dir>]
//                                   create its signing keys, with an encrypted
//                                   backup outside the repo (~/remappr-key-backups)
//   pnpm backend keys-verify <backup>          check a backup (asks its passphrase)
//   pnpm backend keys-restore <backup> <dev|prod>  put backed-up keys on a project
//   pnpm backend sync               before dev / edev: update dev or local,
//                                   never prod (scripts/backend-sync.ts)
//
// The projects come from .env.local (DEV_/PROD_SUPABASE_URL, see
// scripts/backend-env.ts). Anything aimed at prod asks first.
import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { join } from 'node:path'
import { loadEnv } from 'vite'
import { resolveBackend } from './backend-env.ts'
import { syncBackend } from './backend-sync.ts'

const root = join(import.meta.dirname, '..')
const supabase = join(root, 'node_modules', '.bin', 'supabase')
type Target = 'dev' | 'prod'

function run(cmd: string, args: string[]): void {
    execFileSync(cmd, args, { cwd: root, stdio: 'inherit' })
}

/** The project ref of a hosted target, from its URL in .env.local. */
function projectRef(target: Target): string {
    const env = loadEnv('development', root, '')
    const url = env[`${target.toUpperCase()}_SUPABASE_URL`] ?? ''
    const ref = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url)?.[1]
    if (!ref)
        throw new Error(
            `${target.toUpperCase()}_SUPABASE_URL in .env.local is not a supabase.co project URL`,
        )
    return ref
}

function targetOf(arg: string | undefined): Target {
    if (arg === 'dev' || arg === 'prod') return arg
    throw new Error('expected a target: dev or prod')
}

/** Prod asks for the word "prod" before anything happens. */
async function confirm(target: Target, what: string): Promise<void> {
    if (target !== 'prod') return
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question(
        `This will ${what} on PRODUCTION (${projectRef(target)}). Type "prod" to go on: `,
    )
    rl.close()
    if (answer.trim() !== 'prod') throw new Error('stopped; nothing changed')
}

const COMMANDS: Record<
    string,
    (arg?: string, rest?: string[]) => Promise<void>
> = {
    async show() {
        const chosen = resolveBackend(root, 'development')
        console.log(
            `Local runs use: ${chosen.backend} (${chosen.url || 'no URL set'})`,
        )
        console.log(`Trusted signing keys: ${chosen.envName || 'none'}`)
        console.log(
            'Change it with REMAPPR_BACKEND in .env.local, or per run: REMAPPR_BACKEND=prod pnpm dev',
        )
    },
    async sync() {
        const { backend } = resolveBackend(root, 'development')
        syncBackend(backend, {
            root,
            supabase,
            devRef: () => projectRef('dev'),
        })
    },
    async push(arg) {
        const target = targetOf(arg)
        await confirm(target, 'apply the database migrations')
        // Forward only: db push applies new migrations, never resets.
        run(supabase, ['db', 'push', '--project-ref', projectRef(target)])
    },
    async deploy(arg) {
        const target = targetOf(arg)
        await confirm(target, 'deploy the Edge Functions')
        run(supabase, [
            'functions',
            'deploy',
            '--project-ref',
            projectRef(target),
        ])
    },
    async keys(arg, rest = []) {
        const target = targetOf(arg)
        await confirm(
            target,
            rest.includes('--replace')
                ? 'REPLACE the signing keys'
                : 'create the signing keys',
        )
        run(process.execPath, [
            join(root, 'scripts', 'gen-signing-keys.mjs'),
            target === 'prod' ? 'production' : 'staging',
            projectRef(target),
            ...rest,
        ])
    },
    async 'keys-verify'(file) {
        if (!file) throw new Error('which backup file?')
        run(process.execPath, [
            join(root, 'scripts', 'signing-keys-backup.mjs'),
            'verify',
            file,
        ])
    },
    async 'keys-restore'(file, rest = []) {
        const target = targetOf(rest[0])
        if (!file) throw new Error('which backup file?')
        await confirm(target, 'restore the signing keys')
        run(process.execPath, [
            join(root, 'scripts', 'signing-keys-backup.mjs'),
            'restore',
            file,
            projectRef(target),
        ])
    },
}

const [command = 'show', arg, ...rest] = process.argv.slice(2)
const handler = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined
if (!handler) {
    console.error(
        `unknown command "${command}": show, sync, push, deploy, keys, keys-verify or keys-restore`,
    )
    process.exit(2)
}
handler(arg, rest).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
})
