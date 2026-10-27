// pattern-check: skip — defensive Electron lifecycle hooks, no new abstraction
import { app, BrowserWindow, dialog, protocol, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc-handlers'
import { registerBleIpcHandlers, setupBleDeviceSelection } from './ble-manager'
import { setupSerialDeviceSelection } from './serial-picker'
import { startSerialDevicePolling } from './serial'
import { silenceConsoleInProduction } from '../shared/logger'
import { checkForUpdates, registerUpdateIpc } from './update-checker'
import { guardWindowLeave, registerWindowControlsIpc } from './window-controls'
import { setupDeepLinks } from './deep-link'
import {
    PACKAGE_SCHEME_PRIVILEGES,
    registerPackageHandlers,
} from './builder-packages'
import {
    APP_ORIGIN,
    APP_SCHEME_PRIVILEGES,
    registerAppProtocol,
} from './app-scheme'
import {
    prepareStorageMigration,
    registerStorageMigrationHandler,
} from './storage-migration'

// A packaged app never runs with a debugger attached: Chromium's remote
// debugging would let anyone script the renderer (and its builder gate). The
// Node --inspect switches are already off through the EnableNodeCliInspect
// fuse; these are Chromium's.
const DEBUG_SWITCHES = [
    'remote-debugging-port',
    'remote-debugging-pipe',
    'remote-debugging-address',
    'remote-allow-origins',
    'auto-open-devtools-for-tabs',
]
if (app.isPackaged && DEBUG_SWITCHES.some((s) => app.commandLine.hasSwitch(s)))
    app.exit(1)

// One instance only: a second launch (e.g. the OS opening a remappr:// sign-in
// link) hands its argv to this one through 'second-instance' and quits.
const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) app.quit()

// True until the first main window exists. The storage migration's hidden
// window closes before then, and that must not count as "all windows closed".
let starting = true

// Origin allowlist: file:// (packaged app) and the dev-server URL (HMR).
// Used by permission/device handlers and `will-navigate` lockdown so an
// attacker cannot pivot a renderer compromise into self-granting hardware
// access or navigating off-app.
function isAllowedOrigin(origin: string): boolean {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    return (
        origin === APP_ORIGIN ||
        origin.startsWith(`${APP_ORIGIN}/`) ||
        (!!devUrl && origin.startsWith(devUrl))
    )
}

// The packaged renderer's CSP (sent with every app:// response and on any
// other response the session sees). Skipped in dev: Vite's HMR client and the
// React refresh preamble need inline scripts and ws:// to localhost.
// style-src 'unsafe-inline' is required for Radix / Tailwind runtime style
// injection. img-src data: covers icon/svg inlining. connect-src
// https://api.github.com matches update-checker and the start-page release
// news; raw.githubusercontent.com serves news.json and its cover images.
// *.supabase.co (or api.remappr.com) is the cloud backend; the avatar hosts
// serve sign-in provider profile pictures; remappr-pkg: serves the delivered
// builder package.
const APP_CSP =
    "default-src 'self'; " +
    "script-src 'self' 'wasm-unsafe-eval' remappr-pkg:; " +
    "style-src 'self' 'unsafe-inline' remappr-pkg:; " +
    "img-src 'self' data: blob: https://raw.githubusercontent.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://cdn.discordapp.com https://*.supabase.co; " +
    "font-src 'self' data:; " +
    "connect-src 'self' remappr-pkg: https://api.github.com https://raw.githubusercontent.com https://*.supabase.co wss://*.supabase.co https://api.remappr.com wss://api.remappr.com; " +
    "worker-src 'self' blob:; " +
    "frame-src 'none'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'none';"

silenceConsoleInProduction()

if (hasInstanceLock) {
    setupDeepLinks(() => BrowserWindow.getAllWindows()[0] ?? null)
}

// Before ready, in one call (Electron takes one registration): app:// serves
// the packaged renderer, remappr-pkg:// the delivered builder package.
protocol.registerSchemesAsPrivileged([
    APP_SCHEME_PRIVILEGES,
    PACKAGE_SCHEME_PRIVILEGES,
])

// Enable Web Bluetooth (navigator.bluetooth) in Chromium. Must run before
// app.whenReady(). Without this, Electron exposes no `navigator.bluetooth`
// and BLE device discovery silently fails in the renderer.
app.commandLine.appendSwitch('enable-experimental-web-platform-features')

// Chromium's Wayland color-management protocol (HDR plumbing) misbehaves with
// KWin/KDE compositors: every surface commit retries a failing image-description
// round-trip ("wayland_wp_color_manager.cc: Unable to set image transfer
// function" spam) and SDR output can render with a wrong transfer curve — the
// visible symptoms are a laggy window and washed-out/over-contrasted colors.
// We render SDR UI only, so drop the protocol on Linux (no-op under X11).
// See https://issues.chromium.org/issues/476172415
if (process.platform === 'linux') {
    app.commandLine.appendSwitch('disable-features', 'WaylandWpColorManagerV1')
}

function createWindow(): void {
    // Create the browser window.
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'

    const mainWindow = new BrowserWindow({
        width: 1300,
        height: 1100,
        minWidth: 1200,
        minHeight: 1000,
        useContentSize: true,
        show: false,
        autoHideMenuBar: true,
        // macOS must NOT also set frame:false — a frameless window suppresses
        // the native traffic lights, and the renderer hides its own window
        // buttons on darwin, leaving the window with no controls at all. The
        // supported frameless-with-traffic-lights recipe is titleBarStyle
        // alone; Win/Linux stay fully frameless with custom WindowControls.
        ...(isMac
            ? {
                  titleBarStyle: 'hiddenInset' as const,
                  trafficLightPosition: { x: 12, y: 10 },
              }
            : { frame: false }),
        ...(isLinux ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/index.cjs'),
            // The preload is a bundled CommonJS file (electron.vite.config.ts),
            // so the renderer can run in Chromium's sandbox.
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: false,
            // No DevTools in a packaged app (see DEBUG_SWITCHES).
            devTools: !app.isPackaged,
        },
    })

    // Grant Chromium device permissions so navigator.serial / navigator.bluetooth / navigator.hid
    // can surface pickers inside Electron. Gated by origin so external pages opened via
    // shell.openExternal cannot self-grant.
    const sess = mainWindow.webContents.session

    sess.setPermissionCheckHandler((_wc, permission, origin) => {
        const p = permission as string
        return (
            isAllowedOrigin(origin) &&
            (p === 'serial' || p === 'bluetooth' || p === 'hid')
        )
    })

    sess.setPermissionRequestHandler((wc, permission, cb) => {
        const p = permission as string
        const origin = wc?.getURL() ?? ''
        cb(
            isAllowedOrigin(origin) &&
                (p === 'bluetooth' || p === 'serial' || p === 'hid'),
        )
    })

    sess.setDevicePermissionHandler((details) => {
        const t = details.deviceType as string
        return (
            isAllowedOrigin(details.origin) &&
            (t === 'serial' || t === 'usb' || t === 'hid')
        )
    })

    // The CSP on every response the window's session sees (app:// responses
    // also carry it themselves).
    if (!is.dev) {
        sess.webRequest.onHeadersReceived((details, cb) => {
            cb({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [APP_CSP],
                },
            })
        })
    }

    // ZMK Studio's BLE profile uses Just Works / no-input pairing. Auto-confirm
    // the simple-confirm path so paired-on-demand keyboards don't hang for 30s
    // waiting on a UI we don't render. confirmPin gets a native yes/no dialog
    // showing the PIN; providePin (keyboard wants us to type a PIN) has no
    // native input dialog, so deny it with a visible explanation instead of a
    // silent stall.
    sess.setBluetoothPairingHandler((details, cb) => {
        if (details.pairingKind === 'confirm') return cb({ confirmed: true })
        if (details.pairingKind === 'confirmPin') {
            void dialog
                .showMessageBox(mainWindow, {
                    type: 'question',
                    buttons: ['Pair', 'Cancel'],
                    defaultId: 0,
                    cancelId: 1,
                    title: 'Bluetooth pairing',
                    message: `Confirm pairing with "${details.deviceId}"`,
                    detail: `Pair only if the device shows the PIN ${details.pin ?? ''}.`,
                })
                .then(({ response }) => cb({ confirmed: response === 0 }))
                .catch(() => cb({ confirmed: false }))
            return
        }
        // providePin — unsupported; tell the user why pairing failed.
        void dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Bluetooth pairing',
            message: 'This device requires PIN entry, which is not supported.',
            detail: 'Pair the keyboard in your OS Bluetooth settings first, then connect from Remappr.',
        })
        cb({ confirmed: false })
    })

    // Closing, quitting or reloading with unsaved device edits waits on the
    // renderer's Save / Discard / Cancel prompt. The reload keys only reload
    // in dev (the optimizer blocks them in a packaged build).
    guardWindowLeave(mainWindow, { reloadKeys: is.dev })

    // Safety-net handler for any stray navigator.serial.requestPort() calls.
    setupSerialDeviceSelection(mainWindow)

    // Set up BLE device selection handler for Web Bluetooth support
    setupBleDeviceSelection(mainWindow)

    mainWindow.on('ready-to-show', (): void => {
        mainWindow?.show()
    })

    mainWindow.webContents.once('did-finish-load', (): void => {
        void checkForUpdates(mainWindow)
    })

    // Bestow a synthetic user gesture each time the renderer finishes loading
    // so the initial BLE scan (navigator.bluetooth.requestDevice) doesn't
    // bounce with SecurityError. The event fires inside an executeJavaScript
    // call with userGesture=true, giving Web Bluetooth a transient activation.
    // The renderer's useConnection hook listens and re-runs loadDevices. Uses
    // .on() (not .once()) so HMR refreshes / in-renderer reloads also trigger
    // the auto-scan — the renderer's userActivation guard de-dupes.
    mainWindow.webContents.on('did-finish-load', (): void => {
        setTimeout(() => {
            mainWindow.webContents
                .executeJavaScript(
                    `window.dispatchEvent(new CustomEvent('electron-auto-scan'))`,
                    true,
                )
                .catch(() => undefined)
        }, 500)
    })

    mainWindow.webContents.setWindowOpenHandler(
        (details): { action: 'deny' } => {
            // Only forward http/https/mailto to the OS shell. Schemes like
            // file:, smb:, ms-msdt: would otherwise reach the Windows shell
            // via Electron and turn `window.open` into an LPE/RCE primitive.
            try {
                const u = new URL(details.url)
                if (
                    u.protocol === 'https:' ||
                    u.protocol === 'http:' ||
                    u.protocol === 'mailto:'
                ) {
                    void shell.openExternal(details.url)
                }
            } catch {
                /* ignore unparseable URLs */
            }
            return { action: 'deny' }
        },
    )

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadURL(`${APP_ORIGIN}/index.html`)
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then((): void => {
    if (!hasInstanceLock) return
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on(
        'browser-window-created',
        (_: unknown, window: BrowserWindow): void => {
            optimizer.watchWindowShortcuts(window)
        },
    )

    // Global lockdown for any web-contents (main window, popups, devtools).
    // - will-navigate: prevent renderer from leaving the app origin.
    // - setWindowOpenHandler: deny by default for child contents we did not
    //   already wire up in createWindow.
    // - will-attach-webview: defense-in-depth; <webview> is also disabled
    //   per webPreferences but reject the attach here in case it's enabled.
    app.on('web-contents-created', (_evt, contents) => {
        contents.on('will-navigate', (event, navUrl) => {
            try {
                const u = new URL(navUrl)
                if (!isAllowedOrigin(u.origin)) {
                    event.preventDefault()
                }
            } catch {
                event.preventDefault()
            }
        })
        contents.setWindowOpenHandler(() => ({ action: 'deny' }))
        contents.on('will-attach-webview', (event) => {
            event.preventDefault()
        })
    })

    // Register all IPC handlers
    registerIpcHandlers(() => BrowserWindow.getAllWindows())
    registerPackageHandlers()
    registerStorageMigrationHandler()
    registerBleIpcHandlers()
    registerUpdateIpc(() => BrowserWindow.getAllWindows()[0] ?? null)
    registerWindowControlsIpc(() => BrowserWindow.getAllWindows()[0] ?? null)

    // Start USB hotplug polling — pushes SERIAL_DEVICES_CHANGED on changes.
    startSerialDevicePolling(() => BrowserWindow.getAllWindows())

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        createWindow()
        starting = false
    } else {
        // Packaged: serve the renderer over app://, and carry the old file://
        // storage across first (see storage-migration.ts).
        registerAppProtocol(join(__dirname, '../renderer'), APP_CSP)
        void prepareStorageMigration().finally(() => {
            createWindow()
            starting = false
        })
    }

    app.on('activate', function (): void {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', (): void => {
    if (starting) return
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
