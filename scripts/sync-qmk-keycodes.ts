#!/usr/bin/env tsx
// Pattern check: no GoF pattern (-) — rejected — one-shot QMK keycodes.h
// scrape utility; reports drift between authoritative header and
// src/firmware/clients/qmk/keycodes-hex.ts. Run when bumping QMK version.
//
// Usage:
//   pnpm tsx scripts/sync-qmk-keycodes.ts /path/to/qmk_firmware/quantum/keycodes.h
//
// Output: list of QK_* names + hex from header, plus drift report:
//   - hex values in keycodes-hex.ts not present in header (stale)
//   - hex values in header not present in keycodes-hex.ts (uncovered)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { QMK_HEX_BY_CANONICAL } from '../src/firmware/clients/qmk/keycodes-hex'

const headerPath = process.argv[2]
if (!headerPath) {
    console.error('usage: sync-qmk-keycodes.ts <path-to-keycodes.h>')
    process.exit(1)
}

const text = readFileSync(resolve(headerPath), 'utf8')

// Match enum lines like:  QK_FOO_BAR = 0x7C73,  or  QK_FOO_BAR_MAX = 0x7CFF,
const headerHex = new Map<string, number>()
const re = /\b(QK_[A-Z0-9_]+)\s*=\s*0x([0-9A-Fa-f]+)/g
let m: RegExpExecArray | null
while ((m = re.exec(text))) {
    const [, name, hex] = m
    if (name.endsWith('_MAX')) continue
    headerHex.set(name, parseInt(hex, 16))
}

const headerByHex = new Map<number, string[]>()
for (const [name, hex] of headerHex) {
    const list = headerByHex.get(hex) ?? []
    list.push(name)
    headerByHex.set(hex, list)
}

const stale: string[] = []
const covered = new Set<number>()
for (const [id, hex] of Object.entries(QMK_HEX_BY_CANONICAL)) {
    // Basic-range hex (0x00..0xFF) and modifier-wrap range (0x0100..0x1FFF)
    // come from KC_* / S(KC_*) defines, not QK_* enum. Skip drift check.
    if (hex <= 0x1fff) {
        covered.add(hex)
        continue
    }
    if (!headerByHex.has(hex)) {
        stale.push(`${id} → 0x${hex.toString(16)}`)
    } else {
        covered.add(hex)
    }
}

const uncovered: string[] = []
for (const [hex, names] of headerByHex) {
    if (!covered.has(hex)) {
        uncovered.push(`${names.join('=')} (0x${hex.toString(16)})`)
    }
}

console.log(`# QMK keycode sync report`)
console.log(`Header: ${headerPath}`)
console.log(`Header symbols: ${headerHex.size}`)
console.log(`Mapped canonical ids: ${Object.keys(QMK_HEX_BY_CANONICAL).length}`)
console.log(
    `\n## Stale (in keycodes-hex.ts but not in header — ${stale.length})`,
)
for (const s of stale) console.log(`  ${s}`)
console.log(`\n## Uncovered header symbols (${uncovered.length})`)
for (const u of uncovered.slice(0, 200)) console.log(`  ${u}`)
if (uncovered.length > 200) console.log(`  … ${uncovered.length - 200} more`)

process.exit(stale.length > 0 ? 1 : 0)
