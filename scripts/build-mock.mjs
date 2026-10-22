#!/usr/bin/env node
/*
 * Build the "Remappr mock": the real renderer as a static web build (outside
 * Electron it runs in demo mode) plus the floating Tweaks panel from
 * scripts/mock/tweaks.js. Publish the output folder's files under app-live/ in
 * the mock artifact.
 *
 *   pnpm build:mock [outDir]        default: ../remappr-mock-dist
 *
 * The out dir must sit outside the repo: vite empties it before every build.
 *
 * Two post-steps turn vite's output into the mock:
 *   1. Escape literal U+FFFD in JS chunks as its six-character JS escape
 *      (a backslash, then "uFFFD"). The artifact publisher refuses raw U+FFFD;
 *      the monaco and index chunks carry it inside string literals, where the
 *      escape means the same character.
 *   2. Copy tweaks.js to <out>/mock/ and load it just before </body>.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tweaksSrc = path.join(appRoot, 'scripts', 'mock', 'tweaks.js')
const TWEAKS_TAG = '<script src="./mock/tweaks.js"></script>'
const RAW_FFFD = String.fromCharCode(0xfffd)
const ESCAPED_FFFD = '\\uFFFD'
const JS_EXT = new Set(['.js', '.mjs'])
// Text files the publisher reads; everything else (fonts, images) is binary.
const TEXT_EXT = new Set([
    ...JS_EXT,
    '.css',
    '.html',
    '.json',
    '.svg',
    '.txt',
    '.xml',
    '.webmanifest',
])

function fail(message) {
    console.error(`[build-mock] ${message}`)
    process.exit(1)
}

function isWithin(parent, child) {
    const rel = path.relative(parent, child)
    if (path.isAbsolute(rel)) return false
    return rel !== '..' && !rel.startsWith(`..${path.sep}`)
}

function resolveOutDir(arg) {
    const out = path.resolve(
        arg || path.join(appRoot, '..', 'remappr-mock-dist'),
    )
    if (isWithin(appRoot, out) || isWithin(out, appRoot)) {
        fail(`out dir must be outside the repo (vite empties it): ${out}`)
    }
    return out
}

function preflight() {
    const viteBin = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js')
    if (!fs.existsSync(viteBin))
        fail('vite is not installed; run `pnpm install`')
    if (!fs.existsSync(path.join(appRoot, 'src', 'firmware'))) {
        fail(
            'the @remappr projects are not wired (src/firmware is missing); run `pnpm install`, its postinstall links them',
        )
    }
    return viteBin
}

function viteBuild(viteBin, outDir) {
    const args = ['build', '--base', './', '--outDir', outDir, '--emptyOutDir']
    const res = spawnSync(process.execPath, [viteBin, ...args], {
        cwd: appRoot,
        stdio: 'inherit',
    })
    if (res.error) throw res.error
    if (res.status !== 0)
        fail(`vite build failed (${res.status ?? res.signal})`)
}

function listFiles(dir) {
    return fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath, entry.name))
        .sort()
}

function escapeRawFffd(outDir) {
    const chunks = listFiles(outDir).filter((f) => JS_EXT.has(path.extname(f)))
    for (const file of chunks) {
        const text = fs.readFileSync(file, 'utf8')
        const count = text.split(RAW_FFFD).length - 1
        if (count === 0) continue
        fs.writeFileSync(file, text.replaceAll(RAW_FFFD, ESCAPED_FFFD))
        console.log(
            `[build-mock] escaped ${count} U+FFFD in ${path.relative(outDir, file)}`,
        )
    }
}

function injectTweaks(outDir) {
    fs.mkdirSync(path.join(outDir, 'mock'), { recursive: true })
    fs.copyFileSync(tweaksSrc, path.join(outDir, 'mock', 'tweaks.js'))
    const indexPath = path.join(outDir, 'index.html')
    const html = fs.readFileSync(indexPath, 'utf8')
    const at = html.lastIndexOf('</body>')
    if (at === -1)
        fail('index.html has no </body> to load the Tweaks panel before')
    fs.writeFileSync(
        indexPath,
        `${html.slice(0, at)}${TWEAKS_TAG}\n${html.slice(at)}`,
    )
}

function assertNoRawFffd(outDir) {
    const offenders = listFiles(outDir)
        .filter((f) => TEXT_EXT.has(path.extname(f)))
        .filter((f) => fs.readFileSync(f, 'utf8').includes(RAW_FFFD))
    if (offenders.length === 0) return
    const names = offenders.map((f) => path.relative(outDir, f)).join(', ')
    fail(`raw U+FFFD left in: ${names}`)
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

function printFiles(outDir) {
    let total = 0
    const files = listFiles(outDir)
    for (const file of files) {
        const { size } = fs.statSync(file)
        total += size
        console.log(`${kb(size).padStart(12)}  ${path.relative(outDir, file)}`)
    }
    console.log(`${kb(total).padStart(12)}  total, ${files.length} files`)
}

const outArg = process.argv.slice(2).find((arg) => arg !== '--')
const outDir = resolveOutDir(outArg)
const viteBin = preflight()
viteBuild(viteBin, outDir)
escapeRawFffd(outDir)
injectTweaks(outDir)
assertNoRawFffd(outDir)
printFiles(outDir)
console.log(`[build-mock] done: ${outDir}`)
