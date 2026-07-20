// pattern-check: skip — build config script loading JSON language list, no abstraction
const path = require('path')
const fs = require('fs')

const languagesFile = path.join(__dirname, 'build', 'electron-languages.json')
const { languages } = JSON.parse(fs.readFileSync(languagesFile, 'utf8'))

if (!Array.isArray(languages) || languages.length === 0) {
    throw new Error(
        `electron-languages.json must contain a non-empty "languages" array (got: ${JSON.stringify(
            languages,
        )})`,
    )
}

/** @type {import('electron-builder').Configuration} */
module.exports = {
    appId: 'dev.remappr.app',
    productName: 'Remappr',
    compression: 'maximum',
    electronLanguages: languages,
    removePackageScripts: true,
    removePackageKeywords: true,
    directories: {
        buildResources: 'build',
    },
    files: [
        '!**/.vscode/*',
        '!src/**',
        // Build-time source cache from link-remappr.cjs — contains cloned repos
        // whose committed symlinks dangle outside the app root; packaging them
        // breaks the mac universal asar merge.
        '!.remappr/**',
        '!.claude/**',
        '!.flowpatch/**',
        '!**/.flowpatch/**',
        '!docs/**',
        '!build/**/*.{ts,map}',
        '!scripts/**/*',
        '!.storybook/**/*',
        '!stories/**/*',
        '!**/*.stories.{js,jsx,ts,tsx,mdx}',
        '!**/*.test.{js,jsx,ts,tsx}',
        '!**/*.spec.{js,jsx,ts,tsx}',
        '!**/__tests__/**/*',
        '!**/__mocks__/**/*',
        '!**/*.map',
        '!**/.git/**/*',
        '!**/.github/**/*',
        '!**/coverage/**/*',
        '!**/docs/**/*',
        '!electron.vite.config.{js,ts,mjs,cjs}',
        '!vite.config.{js,ts,mjs,cjs}',
        '!vitest.config.{js,ts,mjs,cjs}',
        '!eslint.config.{js,mjs,cjs}',
        '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md,LICENSE,LICENSE.md}',
        '!{.env,.env.*,.npmrc,pnpm-lock.yaml,bun.lockb,yarn.lock,package-lock.json}',
        '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}',
        '!release.config.json',
        '!.release-manifest.json',
        '!build/electron-languages.json',
        // Size trimming — none of these are needed at runtime.
        '!**/*.{md,markdown,mkd}',
        '!**/*.d.ts',
        '!**/*.{ts,tsx,flow}',
        '!**/*.{h,hpp,c,cc,cpp,gyp,gypi,o,obj}',
        '!**/{LICENSE,LICENSE.txt,LICENCE,NOTICE,AUTHORS,CHANGELOG,HISTORY}*',
        '!**/{test,tests,__tests__,spec,powered-test,example,examples,demo,doc,docs}/**',
        '!**/{.editorconfig,.eslintrc*,.prettierrc*,.npmignore,.travis.yml,.gitattributes,tsconfig*.json,.nycrc,karma.conf.js}',
        '!**/{.github,.idea,.vscode}/**',
        '!**/*.{ts.map,js.map,css.map}',
        // Native-module prebuilds for platforms no desktop build targets.
        '!**/prebuilds/*android*/**',
        '!**/prebuilds/*freebsd*/**',
    ],
    asarUnpack: ['resources/**'],
    win: {
        executableName: 'app',
        // Other-OS prebuilds are dead weight in the Windows package.
        files: ['!**/prebuilds/*darwin*/**', '!**/prebuilds/*linux*/**'],
    },
    nsis: {
        artifactName: '${name}-electron-${version}-setup.${ext}',
        shortcutName: '${productName}',
        uninstallDisplayName: '${productName}',
        createDesktopShortcut: 'always',
    },
    mac: {
        // Canonical icon source is the 1024x1024 resources/icon.png;
        // electron-builder generates the full multi-size .icns from it at build
        // time. (The committed build/icon.icns only held a single 512px slice,
        // which macOS renders as a generic icon.)
        icon: 'resources/icon.png',
        // Ship a single universal (x64 + arm64) build so the DMG runs on both
        // Intel and Apple Silicon Macs. Release CI runs on one `macos-latest`
        // (Apple Silicon) runner, so without an explicit arch electron-builder
        // defaults to an arm64-only app that Intel Macs reject with
        // "not supported on this Mac". dmg only — there is no Squirrel.Mac /
        // electron-updater in the app (updates are a GitHub releases check +
        // notification), so a zip artifact would never be consumed.
        target: [{ target: 'dmg', arch: ['universal'] }],
        // node-hid bundles prebuilt single-arch darwin binaries
        // (prebuilds/HID-darwin-{x64,arm64}/*.node) that are byte-identical in
        // the x64 and arm64 single-arch builds. @electron/universal refuses to
        // merge a Mach-O file that is identical in both unless it is declared
        // here — they are correct as-is (the arch-appropriate prebuild loads at
        // runtime). Files that genuinely differ per arch (node-hid's rebuilt
        // build/Release/HID.node) are still lipo-merged into a fat binary; this
        // rule only whitelists the identical-in-both case, so it can't mask a
        // broken single-arch merge of the real runtime binary.
        x64ArchFiles:
            '**/node_modules/{node-hid,@serialport/bindings-cpp}/**/*.node',
        // Ad-hoc code signature ('-'). We have no Apple Developer ID (this is an
        // open-source project), but macOS 15's TCC subsystem SIGABRTs an
        // *unsigned* app the moment it touches Bluetooth (CoreBluetooth) — the
        // renderer auto-scans BLE ~0.5s after load, so an unsigned build crashes
        // ~6s into every launch despite the NSBluetooth* usage strings. An
        // ad-hoc signature gives the app a stable cdhash so TCC can attribute the
        // Bluetooth grant; verified to stop the crash. It does NOT satisfy
        // Gatekeeper on download (users still right-click → Open once, or run
        // `xattr -dr com.apple.quarantine`), which only Developer ID +
        // notarization removes.
        identity: '-',
        // hardenedRuntime is only needed for notarization (which requires a
        // Developer ID we don't have). With ad-hoc signing it forces library
        // validation, which would reject our own non-Apple-signed native modules
        // and fail launch unless further entitlements are added — so keep it off.
        hardenedRuntime: false,
        entitlements: 'build/entitlements.mac.plist',
        entitlementsInherit: 'build/entitlements.mac.plist',
        extendInfo: {
            NSBluetoothAlwaysUsageDescription:
                'Remappr uses Bluetooth to connect to keyboards over BLE.',
        },
        notarize: false,
        // Other-OS prebuilds are not Mach-O: they can never load on macOS and
        // they break the CI universal-lipo assertion (lipo reads them as
        // "unreadable"). Strip them from the mac package.
        files: ['!**/prebuilds/*linux*/**', '!**/prebuilds/*win32*/**'],
    },
    dmg: {
        artifactName: '${name}-electron-${version}.${ext}',
    },
    linux: {
        target: ['AppImage', 'deb', 'rpm', 'pacman', 'tar.gz'],
        maintainer: 'Wolffyx <wolffyx@wolffyx.com>',
        category: 'Utility',
        // Other-OS prebuilds are dead weight in the Linux package.
        files: ['!**/prebuilds/*darwin*/**', '!**/prebuilds/*win32*/**'],
    },
    appImage: {
        artifactName: '${name}-electron-${version}.${ext}',
    },
    deb: {
        artifactName: '${name}-electron-${version}.${ext}',
    },
    rpm: {
        artifactName: '${name}-electron-${version}.${ext}',
    },
    pacman: {
        artifactName: '${name}-electron-${version}.${ext}',
    },
    npmRebuild: true,
    afterPack: path.join(__dirname, 'build', 'afterPack.cjs'),
    // No `publish` config on purpose: the app has no electron-updater /
    // Squirrel — update-checker.ts polls GitHub releases and links the user
    // there. A publish block would only emit dead latest*.yml metadata.
    publish: null,
}
