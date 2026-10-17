// Pattern check: Dispatch Map (Tier 0) — applied — leave action (close / reload) → handler map for the unsaved-changes guard; the rest is plain ipcMain wiring for window min/max/close.
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IpcChannels, IpcEvents } from '../shared/ipc-types'

/** What a held leave does once the user chooses to go. */
type LeaveAction = 'close' | 'reload'

/** Unsaved-changes guard, per window. `unsaved` mirrors the renderer (a
 *  device holds edits that leaving would lose); `action` is the leave waiting
 *  on the renderer's prompt; `allowLeave` is set once the user chose to go, so
 *  the unload that follows goes through. */
interface LeaveGuard {
    unsaved: boolean
    action: LeaveAction | null
    allowLeave: boolean
}

const guards = new WeakMap<BrowserWindow, LeaveGuard>()

/** A quit (app.quit, Cmd+Q) is under way; a leave the user cancels ends it. */
let quitting = false

const LEAVE: Record<LeaveAction, (win: BrowserWindow) => void> = {
    close: (win) => {
        if (quitting) app.quit()
        else win.close()
    },
    reload: (win) => win.webContents.reload(),
}

function guardFor(sender: Electron.WebContents): {
    win: BrowserWindow
    guard: LeaveGuard
} | null {
    const win = BrowserWindow.fromWebContents(sender)
    const guard = win ? guards.get(win) : undefined
    return win && guard ? { win, guard } : null
}

/** Ctrl+R / Cmd+R, with or without Shift (reload, force reload). */
function isReloadKey(input: Electron.Input): boolean {
    return (
        input.type === 'keyDown' &&
        input.code === 'KeyR' &&
        (input.control || input.meta)
    )
}

export interface GuardWindowOptions {
    /** Also route the reload keys through the prompt. Only where they reload
     *  at all: a packaged build has them blocked by the toolkit optimizer. */
    reloadKeys?: boolean
}

/**
 * Hold a leave of `win` while a device holds unsaved edits, and let the
 * renderer's Save / Discard / Cancel prompt decide (WINDOW_LEAVE_REQUESTED →
 * WINDOW_LEAVE_DECIDED). Covers closing (its close button, Alt+F4, the
 * taskbar), quitting, and the reload keys. A reload from elsewhere (the
 * menu) cannot wait for the prompt: the renderer blocks the unload and the
 * native Leave / Stay box below decides instead.
 */
export function guardWindowLeave(
    win: BrowserWindow,
    options: GuardWindowOptions = {},
): void {
    const guard: LeaveGuard = {
        unsaved: false,
        action: null,
        allowLeave: false,
    }
    guards.set(win, guard)

    const askRenderer = (action: LeaveAction): void => {
        guard.action = action
        win.webContents.send(IpcEvents.WINDOW_LEAVE_REQUESTED)
    }

    win.on('close', (event): void => {
        if (guard.allowLeave || !guard.unsaved) return
        event.preventDefault()
        askRenderer('close')
    })

    if (options.reloadKeys) {
        win.webContents.on('before-input-event', (event, input): void => {
            if (!guard.unsaved || !isReloadKey(input)) return
            event.preventDefault()
            askRenderer('reload')
        })
    }

    // A fresh page holds no edits and has decided nothing; it reports its
    // own state once it is up.
    win.webContents.on('did-finish-load', (): void => {
        Object.assign(guard, {
            unsaved: false,
            action: null,
            allowLeave: false,
        })
    })

    // A renderer that is gone can no longer answer, nor hold edits.
    win.webContents.on('render-process-gone', (): void => {
        guard.unsaved = false
    })

    win.webContents.on('will-prevent-unload', (event): void => {
        // The user already chose to leave in the renderer's prompt.
        if (guard.allowLeave) {
            event.preventDefault()
            return
        }
        const choice = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['Leave', 'Stay'],
            defaultId: 1,
            cancelId: 1,
            title: 'Unsaved changes',
            message: 'Leave without saving?',
            detail: 'Some changes are not saved on the device yet.',
        })
        if (choice === 0) event.preventDefault()
    })
}

export function registerWindowControlsIpc(
    getMainWindow: () => BrowserWindow | null,
): void {
    app.on('before-quit', (): void => {
        quitting = true
    })

    ipcMain.handle(IpcChannels.WINDOW_MINIMIZE, () => {
        getMainWindow()?.minimize()
    })

    ipcMain.handle(IpcChannels.WINDOW_MAXIMIZE_TOGGLE, () => {
        const win = getMainWindow()
        if (!win) return false
        if (win.isMaximized()) {
            win.unmaximize()
            return false
        }
        win.maximize()
        return true
    })

    ipcMain.handle(IpcChannels.WINDOW_CLOSE, () => {
        getMainWindow()?.close()
    })

    ipcMain.handle(IpcChannels.WINDOW_IS_MAXIMIZED, () => {
        return getMainWindow()?.isMaximized() ?? false
    })

    ipcMain.handle(
        IpcChannels.WINDOW_SET_UNSAVED,
        (event, unsaved: unknown) => {
            const target = guardFor(event.sender)
            if (target) target.guard.unsaved = unsaved === true
        },
    )

    ipcMain.handle(
        IpcChannels.WINDOW_LEAVE_DECIDED,
        (event, leave: unknown) => {
            const target = guardFor(event.sender)
            const action = target?.guard.action
            // No leave is waiting (a second answer to a shared prompt).
            if (!target || !action) return
            target.guard.action = null
            if (leave !== true) {
                quitting = false
                return
            }
            target.guard.allowLeave = true
            LEAVE[action](target.win)
        },
    )
}
