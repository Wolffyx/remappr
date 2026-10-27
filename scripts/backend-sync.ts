// Pattern check: Dispatch Map (Tier 0) — applied — backend name maps to its startup sync step; dev pushes and deploys, local applies, prod only reports
//
// Runs before `pnpm dev` / `pnpm edev` (pnpm backend sync): keeps the backend
// those runs use up to date with this checkout, forward only.
// - dev: applies new migrations (supabase db push, which never resets or
//   rolls back) and deploys the Edge Functions when they changed since the
//   last deploy from this machine.
// - local: applies new migrations to the running local stack (migration up,
//   no reset).
// - prod: nothing, ever. Production changes go through pnpm backend push /
//   deploy prod (which ask first) or the release pipeline.
// A failure (offline, CLI not signed in) only warns: the app starts anyway.
// REMAPPR_SKIP_SYNC=1 skips it.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Backend } from './backend-env.ts'

export interface SyncContext {
    root: string
    supabase: string
    /** The dev project's ref (from .env.local). */
    devRef: () => string
}

function cli(ctx: SyncContext, args: string[]): string {
    return execFileSync(ctx.supabase, args, {
        cwd: ctx.root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    })
}

/** sha256 over every function source file and the [functions.*] config, so
 *  a deploy happens only when something it ships changed. */
function functionsHash(root: string): string {
    const hash = createHash('sha256')
    const dir = join(root, 'supabase', 'functions')
    const files = readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((f) => f.isFile() && !f.name.startsWith('.env'))
        .map((f) => join(f.parentPath, f.name))
        .sort()
    for (const file of files) {
        hash.update(relative(dir, file))
        hash.update(readFileSync(file))
    }
    const config = readFileSync(join(root, 'supabase', 'config.toml'), 'utf8')
    hash.update(config.match(/^\[functions\.[^\]]+\][^[]*/gm)?.join('') ?? '')
    return hash.digest('hex')
}

function syncDev(ctx: SyncContext): void {
    const ref = ctx.devRef()
    const plan = cli(ctx, ['db', 'push', '--dry-run', '--project-ref', ref])
    if (plan.includes('"upToDate":true') || /up to date/i.test(plan)) {
        console.info('[remappr] dev database: up to date')
    } else {
        console.info('[remappr] dev database: applying new migrations')
        cli(ctx, ['db', 'push', '--yes', '--project-ref', ref])
    }

    const stamp = join(ctx.root, 'supabase', '.temp', `functions-${ref}.sha256`)
    const current = functionsHash(ctx.root)
    const deployed = (() => {
        try {
            return readFileSync(stamp, 'utf8').trim()
        } catch {
            return ''
        }
    })()
    if (deployed === current) {
        console.info('[remappr] dev functions: up to date')
        return
    }
    console.info('[remappr] dev functions: deploying')
    cli(ctx, ['functions', 'deploy', '--project-ref', ref])
    mkdirSync(join(ctx.root, 'supabase', '.temp'), { recursive: true })
    writeFileSync(stamp, current)
}

function syncLocal(ctx: SyncContext): void {
    try {
        cli(ctx, ['status'])
    } catch {
        console.warn(
            '[remappr] local stack is not running: start it with pnpm db:start',
        )
        return
    }
    cli(ctx, ['migration', 'up', '--local'])
    console.info('[remappr] local database: up to date')
}

const STEPS: Record<Backend, (ctx: SyncContext) => void> = {
    dev: syncDev,
    local: syncLocal,
    prod: () =>
        console.info(
            '[remappr] prod selected: nothing is changed on production automatically',
        ),
}

/** Bring the backend local runs use up to date; never throws. */
export function syncBackend(backend: Backend | 'ci', ctx: SyncContext): void {
    if (backend === 'ci' || process.env.REMAPPR_SKIP_SYNC) return
    try {
        STEPS[backend](ctx)
    } catch (e) {
        const detail =
            (e as { stderr?: string }).stderr?.toString().trim() ||
            (e instanceof Error ? e.message : String(e))
        console.warn(
            `[remappr] could not sync the ${backend} backend; starting anyway.\n${detail}`,
        )
    }
}
