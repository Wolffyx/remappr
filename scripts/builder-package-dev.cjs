#!/usr/bin/env node
/*
 * Build the builder package in the sibling remapprBuilder repo and copy it to
 * public/_pkg/builder/<version>/ so the dev server serves it. Then, in the app
 * (dev build), set localStorage `remappr.builder.packageUrl` to
 * "/_pkg/builder/<version>/" to load the package instead of the bundled
 * builder. public/_pkg is git-ignored.
 */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const appRoot = path.resolve(__dirname, '..')
const builderRoot = path.resolve(
    appRoot,
    '..',
    '..',
    'Remappr',
    'remapprBuilder',
)
if (!fs.existsSync(path.join(builderRoot, 'vite.package.config.ts'))) {
    console.error(`No builder repo with a package build at ${builderRoot}`)
    process.exit(1)
}
execFileSync('pnpm', ['build:package'], { cwd: builderRoot, stdio: 'inherit' })
const built = path.join(builderRoot, 'dist-package', 'builder')
const target = path.join(appRoot, 'public', '_pkg', 'builder')
fs.rmSync(target, { recursive: true, force: true })
fs.cpSync(built, target, { recursive: true })
for (const version of fs.readdirSync(target))
    console.log(`Builder package ${version} → /_pkg/builder/${version}/`)
