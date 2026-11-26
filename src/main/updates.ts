// Pattern check: Strategy (Tier 1) — applied — two update strategies
// (electron-updater installs, GitHub notify-only) behind one check/install
// surface, picked once per install by updateMode().
//
// App updates (plan §6c B, P11). Self-updating installs (AppImage, NSIS,
// Developer ID signed macOS) download the release from GitHub in the
// background and install it on restart or quit: the renderer gets
// UPDATE_DOWNLOADED and offers a restart. Every other install keeps the
// notify-only check (update-checker.ts: UPDATE_AVAILABLE → "Download").
//
// electron-updater checks the download against the sha512 in the release's
// latest*.yml, and on Windows against the publisher of a signed build. Both
// come from the same GitHub release a manual download would use.
import { app, BrowserWindow, ipcMain } from 'electron'
import updaterPkg from 'electron-updater'
import {
    IpcChannels,
    IpcEvents,
    type UpdateCheckResultPayload,
    type UpdateDownloadedPayload,
} from '../shared/ipc-types'
import { createLogger } from '../shared/logger'
import { checkForUpdates } from './update-checker'
import { updateMode, type UpdateMode } from './update-mode'

const { autoUpdater } = updaterPkg
const log = createLogger('updates')

type WindowGetter = () => BrowserWindow | null

interface UpdateStrategy {
    check(getWindow: WindowGetter): Promise<UpdateCheckResultPayload>
    install(): void
}

let wired = false

/** Listen once: a downloaded update is offered to the window. */
function wireAutoUpdater(getWindow: WindowGetter): void {
    if (wired) return
    wired = true
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = log
    autoUpdater.on('update-downloaded', (info) => {
        const win = getWindow()
        if (!win || win.isDestroyed()) return
        const payload: UpdateDownloadedPayload = { version: info.version }
        win.webContents.send(IpcEvents.UPDATE_DOWNLOADED, payload)
    })
    autoUpdater.on('error', (e: Error) =>
        log.warn('update check or download failed', e.message),
    )
}

const autoStrategy: UpdateStrategy = {
    async check(getWindow) {
        wireAutoUpdater(getWindow)
        try {
            const result = await autoUpdater.checkForUpdates()
            if (!result) return { status: 'current' }
            const version = result.updateInfo.version
            return result.isUpdateAvailable
                ? { status: 'newer', version }
                : { status: 'current', version }
        } catch (e) {
            // A release whose installers are still uploading has no
            // latest*.yml yet: try again at the next check.
            return {
                status: 'error',
                error: e instanceof Error ? e.message : String(e),
            }
        }
    },
    install() {
        autoUpdater.quitAndInstall()
    },
}

const notifyStrategy: UpdateStrategy = {
    check: (getWindow) => checkForUpdates(getWindow()),
    install() {
        // Nothing to install: the "Download" toast links to the release.
    },
}

const STRATEGIES: Record<UpdateMode, UpdateStrategy> = {
    auto: autoStrategy,
    notify: notifyStrategy,
}

let current: UpdateStrategy | null = null

function strategy(): UpdateStrategy {
    current ??=
        STRATEGIES[
            updateMode({
                platform: process.platform,
                isPackaged: app.isPackaged,
                appImage: process.env.APPIMAGE,
                portableDir: process.env.PORTABLE_EXECUTABLE_DIR,
                macSigned: __MAC_AUTO_UPDATE__,
            })
        ]
    return current
}

/** The startup check (and the one behind Settings → About). */
export function checkForAppUpdates(
    getWindow: WindowGetter,
): Promise<UpdateCheckResultPayload> {
    return strategy().check(getWindow)
}

export function registerUpdateIpc(getWindow: WindowGetter): void {
    ipcMain.handle(IpcChannels.UPDATES_CHECK, () =>
        checkForAppUpdates(getWindow),
    )
    ipcMain.handle(IpcChannels.UPDATES_INSTALL, () => strategy().install())
}
