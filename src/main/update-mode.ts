// Pattern check: Dispatch Map (Tier 0) — applied — the update mode is a
// per-platform lookup (linux → AppImage?, win32 → not portable?, darwin →
// Developer ID signed?).
//
// Which installs update themselves (electron-updater) and which only say a
// release is out (update-checker.ts). AppImage and the NSIS installer replace
// themselves; a macOS app only when it is Developer ID signed (Squirrel.Mac
// refuses ad-hoc ones). deb/rpm/pacman/tar.gz belong to the package manager or
// the user, and the Windows portable exe has no installer to run.

export type UpdateMode = 'auto' | 'notify'

export interface InstallFacts {
    platform: string
    isPackaged: boolean
    /** Set by the AppImage runtime to the image's path. */
    appImage?: string
    /** Set by electron-builder's portable target. */
    portableDir?: string
    /** Built with a Developer ID (see __MAC_AUTO_UPDATE__). */
    macSigned: boolean
}

const BY_PLATFORM: Readonly<Record<string, (f: InstallFacts) => boolean>> = {
    linux: (f) => !!f.appImage,
    win32: (f) => !f.portableDir,
    darwin: (f) => f.macSigned,
}

export function updateMode(facts: InstallFacts): UpdateMode {
    if (!facts.isPackaged) return 'notify'
    const selfUpdates = BY_PLATFORM[facts.platform]
    return selfUpdates?.(facts) ? 'auto' : 'notify'
}
