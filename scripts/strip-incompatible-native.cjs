// pattern-check: skip — mechanical fs cleanup script, no abstraction/new logic
//
// usocket is an unmaintained Nan-era native addon, pulled in as an OPTIONAL
// dependency of dbus-next as its Unix-socket transport. We no longer use it on
// ANY platform: dbus-next is patched (patches/dbus-next@0.10.2.patch) to talk
// to the D-Bus system bus over Node's built-in `net` instead. usocket is dead
// weight that actively breaks the build — two independent reasons:
//   1. Its read path wraps recv buffers in EXTERNAL ArrayBuffers, which aborts
//      under Electron's V8 memory cage (v8_ArrayBuffer_NewBackingStore fatal).
//   2. Its bundled Nan no longer compiles against Electron 42's V8 (the new
//      3-arg v8::External::New), so electron-builder's native rebuild fails
//      and the whole `pnpm install` exits non-zero.
//
// So strip usocket from the install tree on EVERY platform BEFORE any electron
// rebuild runs (this script is the first half of the root `postinstall`).
// dbus-next's BlueZ access is path-socket only and needs no Unix-fd passing,
// so the `net` transport is a full replacement. Handles both pnpm layouts:
// hoisted (node-linker=hoisted, real dir at node_modules/usocket) and isolated
// (.pnpm store + symlinks).

const fs = require('fs')
const path = require('path')

const nodeModulesDir = path.join(__dirname, '..', 'node_modules')

function rm(target) {
    try {
        if (!fs.existsSync(target)) return
        fs.rmSync(target, { recursive: true, force: true })
        console.log(
            `strip-incompatible-native: removed ${path.relative(process.cwd(), target)}`,
        )
    } catch (err) {
        console.warn(
            `strip-incompatible-native: could not remove ${target}: ${err.message}`,
        )
    }
}

if (!fs.existsSync(nodeModulesDir)) {
    process.exit(0)
}

// Hoisted layout: real dir / symlink at the top level.
rm(path.join(nodeModulesDir, 'usocket'))

// Isolated (.pnpm) layout: the real store dir + per-package symlinks.
const pnpmDir = path.join(nodeModulesDir, '.pnpm')
if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir)) {
        // The real package store dir, e.g. usocket@0.3.0_patch_hash=...
        if (entry.startsWith('usocket@')) {
            rm(path.join(pnpmDir, entry))
            continue
        }
        // A symlink like dbus-next@x/node_modules/usocket into the store.
        rm(path.join(pnpmDir, entry, 'node_modules', 'usocket'))
    }
}
