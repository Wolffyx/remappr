// Pattern check: Dispatch Map (Tier 0) — applied — host key → reader table and platform → media/volume reader table; no class hierarchy needed.
//
// What this computer is doing, for the device's screens (display part design
// §4-§5): CPU and RAM use, the playing media's title and artist, the output
// volume. The renderer asks for the keys the connected device shows (its
// GET_HOST_KEYS) once a second and pushes them; nothing runs here between
// asks, so a closed window or a disconnected device costs nothing.
//
// Media and volume: Linux reads MPRIS players over the session D-Bus
// (dbus-next, the same lazily-loaded module BlueZ uses) and the default sink's
// volume from wpctl / pactl. macOS and Windows report none yet: the device
// shows "--" for them.
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import type dbus from 'dbus-next'
import {
    IpcChannels,
    type HostStatKey,
    HOST_STAT_KEYS,
} from '../shared/ipc-types'
import { createLogger } from '../shared/logger'

const log = createLogger('host-stats')
const run = promisify(execFile)
const requireDbus = createRequire(import.meta.url)

export type HostStats = Partial<Record<HostStatKey, number | string>>

/* ---- CPU / RAM --------------------------------------------------------------- */

interface CpuTimes {
    idle: number
    total: number
}

const cpuTimes = (): CpuTimes =>
    os.cpus().reduce(
        (acc, c) => {
            const t = c.times
            acc.idle += t.idle
            acc.total += t.user + t.nice + t.sys + t.idle + t.irq
            return acc
        },
        { idle: 0, total: 0 },
    )

let lastCpu: CpuTimes | null = null

/** Busy share of every core since the last ask (0 on the first). */
export function cpuPercent(
    now: CpuTimes = cpuTimes(),
    prev: CpuTimes | null = lastCpu,
): number {
    lastCpu = now
    if (!prev) return 0
    const total = now.total - prev.total
    if (total <= 0) return 0
    return Math.round(100 * (1 - (now.idle - prev.idle) / total))
}

/** RAM in use, %. Linux counts reclaimable cache as free (MemAvailable). */
export function memPercent(meminfo?: string): number {
    const avail = meminfo && /^MemAvailable:\s+(\d+)\s+kB/m.exec(meminfo)
    const total = meminfo && /^MemTotal:\s+(\d+)\s+kB/m.exec(meminfo)
    const free =
        avail && total
            ? Number(avail[1]) / Number(total[1])
            : os.freemem() / os.totalmem()
    return Math.round(100 * (1 - free))
}

const readMeminfo = (): Promise<string | undefined> =>
    process.platform === 'linux'
        ? readFile('/proc/meminfo', 'utf8').catch(() => undefined)
        : Promise.resolve(undefined)

/* ---- media (MPRIS) ------------------------------------------------------------- */

export interface Media {
    title?: string
    artist?: string
}

const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.'
const MPRIS_PATH = '/org/mpris/MediaPlayer2'
const MPRIS_PLAYER = 'org.mpris.MediaPlayer2.Player'

type DbusLib = typeof dbus
let sessionBus: dbus.MessageBus | null = null

function bus(): { lib: DbusLib; bus: dbus.MessageBus } {
    const lib = requireDbus('dbus-next') as DbusLib
    if (!sessionBus) {
        sessionBus = lib.sessionBus()
        // A dropped bus is made again on the next ask.
        sessionBus.on('error', (e: unknown) => {
            log.warn('session bus error', e)
            sessionBus = null
        })
    }
    return { lib, bus: sessionBus }
}

async function call(
    destination: string,
    path: string,
    iface: string,
    member: string,
    signature = '',
    body: unknown[] = [],
): Promise<unknown> {
    const { lib, bus: b } = bus()
    const reply = await b.call(
        new lib.Message({
            destination,
            path,
            interface: iface,
            member,
            signature,
            body,
        }),
    )
    return reply?.body[0]
}

const prop = async (name: string, key: string): Promise<unknown> => {
    const v = (await call(
        name,
        MPRIS_PATH,
        'org.freedesktop.DBus.Properties',
        'Get',
        'ss',
        [MPRIS_PLAYER, key],
    )) as dbus.Variant | undefined
    return v?.value
}

/** The playing player's media (else a paused one's), from MPRIS metadata. */
export function pickMedia(
    players: readonly {
        status: unknown
        meta: Record<string, dbus.Variant> | undefined
    }[],
): Media {
    const p =
        players.find((x) => x.status === 'Playing') ??
        players.find((x) => x.status === 'Paused')
    if (!p?.meta) return {}
    const title = p.meta['xesam:title']?.value
    const raw = p.meta['xesam:artist']?.value
    // A list of artists (MPRIS), some players send [""] for none.
    const artist = (Array.isArray(raw) ? raw : [raw])
        .filter((a): a is string => typeof a === 'string' && a !== '')
        .join(', ')
    return {
        ...(typeof title === 'string' && title ? { title } : {}),
        ...(artist ? { artist } : {}),
    }
}

async function linuxMedia(): Promise<Media> {
    const names = (await call(
        'org.freedesktop.DBus',
        '/org/freedesktop/DBus',
        'org.freedesktop.DBus',
        'ListNames',
    )) as string[]
    const players = await Promise.all(
        names
            .filter((n) => n.startsWith(MPRIS_PREFIX))
            .map(async (n) => ({
                status: await prop(n, 'PlaybackStatus').catch(() => undefined),
                meta: (await prop(n, 'Metadata').catch(() => undefined)) as
                    | Record<string, dbus.Variant>
                    | undefined,
            })),
    )
    return pickMedia(players)
}

/* ---- volume ------------------------------------------------------------------- */

/** `wpctl get-volume` ("Volume: 0.45 [MUTED]") or `pactl get-sink-volume`
 *  ("... / 45% / ...") output -> %, muted = 0. */
export function parseVolume(out: string): number | undefined {
    if (/\[MUTED\]/.test(out)) return 0
    const wp = /Volume:\s+([\d.]+)/.exec(out)
    if (wp && !out.includes('%')) return Math.round(Number(wp[1]) * 100)
    const pa = /(\d+)%/.exec(out)
    return pa ? Number(pa[1]) : undefined
}

async function linuxVolume(): Promise<number | undefined> {
    const tries: [string, string[]][] = [
        ['wpctl', ['get-volume', '@DEFAULT_AUDIO_SINK@']],
        ['pactl', ['get-sink-volume', '@DEFAULT_SINK@']],
    ]
    for (const [cmd, args] of tries) {
        const out = await run(cmd, args, { timeout: 500 }).catch(() => null)
        const v = out && parseVolume(out.stdout)
        if (v !== undefined && v !== null) return v
    }
    return undefined
}

interface PlatformReaders {
    media: () => Promise<Media>
    volume: () => Promise<number | undefined>
}

const NONE: PlatformReaders = {
    media: async () => ({}),
    volume: async () => undefined,
}

/* Platform -> how to read media and volume (macOS / Windows: later). */
const PLATFORM: Partial<Record<NodeJS.Platform, PlatformReaders>> = {
    linux: { media: linuxMedia, volume: linuxVolume },
}

/* ---- one ask ------------------------------------------------------------------- */

interface Ask {
    keys: ReadonlySet<HostStatKey>
    media: () => Promise<Media>
}

/* Key -> its reader (Dispatch Map). */
const READERS: Record<
    HostStatKey,
    (ask: Ask) => Promise<number | string | undefined>
> = {
    cpu: async () => cpuPercent(),
    ram: async () => memPercent(await readMeminfo()),
    mediaTitle: async (a) => (await a.media()).title,
    mediaArtist: async (a) => (await a.media()).artist,
    volume: async () => (PLATFORM[process.platform] ?? NONE).volume(),
}

/** The values of @p keys this computer has now (a key it has none for is
 *  left out). */
export async function readHostStats(
    keys: readonly HostStatKey[],
): Promise<HostStats> {
    const readers = PLATFORM[process.platform] ?? NONE
    let media: Promise<Media> | null = null
    const ask: Ask = {
        keys: new Set(keys),
        // Title and artist share one read.
        media: () =>
            (media ??= readers.media().catch((e: unknown) => {
                log.debug('media read failed', e)
                return {}
            })),
    }
    const out: HostStats = {}
    for (const key of ask.keys) {
        const v = await READERS[key](ask).catch((e: unknown) => {
            log.debug(`${key} read failed`, e)
            return undefined
        })
        if (v !== undefined) out[key] = v
    }
    return out
}

const isStatKey = (k: unknown): k is HostStatKey =>
    typeof k === 'string' && (HOST_STAT_KEYS as readonly string[]).includes(k)

export function registerHostStatsHandler(): void {
    ipcMain.handle(IpcChannels.HOST_STATS_READ, (_e, keys: unknown) => {
        if (!Array.isArray(keys)) return {}
        return readHostStats(keys.filter(isStatKey))
    })
}
