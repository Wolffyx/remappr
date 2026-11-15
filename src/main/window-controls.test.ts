// pattern-check: skip — unit test with electron mocked, no production logic
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannels, IpcEvents } from '../shared/ipc-types'

type Handler = (...args: unknown[]) => unknown

const electron = vi.hoisted(() => ({
    ipc: new Map<string, Handler>(),
    appEvents: new Map<string, Handler>(),
    windows: new Map<unknown, unknown>(),
    quit: vi.fn(),
    showMessageBoxSync: vi.fn(() => 1),
}))

vi.mock('electron', () => ({
    app: {
        on: (event: string, cb: Handler) => electron.appEvents.set(event, cb),
        quit: () => electron.quit(),
    },
    BrowserWindow: {
        fromWebContents: (wc: unknown) => electron.windows.get(wc) ?? null,
    },
    dialog: {
        showMessageBoxSync: (...args: unknown[]) =>
            electron.showMessageBoxSync(...(args as [])),
    },
    ipcMain: {
        handle: (channel: string, fn: Handler) => electron.ipc.set(channel, fn),
    },
}))

/* A window with its webContents; close() runs the close handlers like
 * Electron does and reports whether a handler held it. */
function makeWindow(): {
    win: never
    close: () => boolean
    unload: () => boolean
    key: (input: Partial<Electron.Input>) => boolean
    loaded: () => void
    gone: () => void
    send: ReturnType<typeof vi.fn>
    closed: ReturnType<typeof vi.fn>
    reload: ReturnType<typeof vi.fn>
} {
    const winEvents = new Map<string, Handler>()
    const wcEvents = new Map<string, Handler>()
    const send = vi.fn()
    const closed = vi.fn()
    const reload = vi.fn()
    const fire = (
        handler: Handler | undefined,
        ...args: unknown[]
    ): boolean => {
        let prevented = false
        handler?.({ preventDefault: () => (prevented = true) }, ...args)
        return prevented
    }
    const webContents = {
        on: (event: string, cb: Handler) => wcEvents.set(event, cb),
        send,
        reload,
    }
    const win = {
        on: (event: string, cb: Handler) => winEvents.set(event, cb),
        webContents,
        close: (): void => {
            if (!fire(winEvents.get('close'))) closed()
        },
    }
    electron.windows.set(webContents, win)
    return {
        win: win as never,
        close: () => fire(winEvents.get('close')),
        unload: () => fire(wcEvents.get('will-prevent-unload')),
        key: (input) =>
            fire(wcEvents.get('before-input-event'), {
                type: 'keyDown',
                code: 'KeyR',
                control: true,
                meta: false,
                ...input,
            }),
        loaded: () => wcEvents.get('did-finish-load')?.(),
        gone: () => wcEvents.get('render-process-gone')?.(),
        send,
        closed,
        reload,
    }
}

let mod: typeof import('./window-controls')

beforeEach(async () => {
    vi.resetModules()
    electron.ipc.clear()
    electron.appEvents.clear()
    electron.quit.mockClear()
    electron.showMessageBoxSync.mockReset().mockReturnValue(1)
    mod = await import('./window-controls')
    mod.registerWindowControlsIpc(() => null)
})

const fromRenderer = (
    w: ReturnType<typeof makeWindow>,
    channel: string,
    value: unknown,
): unknown =>
    electron.ipc.get(channel)!(
        { sender: (w.win as { webContents: unknown }).webContents },
        value,
    )

describe('guardWindowLeave', () => {
    it('lets a window with nothing unsaved close', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win)
        expect(w.close()).toBe(false)
        expect(w.send).not.toHaveBeenCalled()
    })

    it('holds the close while unsaved and asks the renderer', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win)
        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)

        expect(w.close()).toBe(true)
        expect(w.send).toHaveBeenCalledWith(IpcEvents.WINDOW_LEAVE_REQUESTED)
    })

    it('closes once the renderer says leave', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win)
        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)
        w.close()

        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, true)

        expect(w.closed).toHaveBeenCalledTimes(1)
        expect(electron.quit).not.toHaveBeenCalled()
    })

    it('stays open when the renderer says stay', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win)
        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)
        w.close()

        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, false)

        expect(w.closed).not.toHaveBeenCalled()
        expect(w.close()).toBe(true) // still guarded
    })

    it('finishes a quit after leave, and a cancelled quit stays cancelled', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win)
        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)

        electron.appEvents.get('before-quit')!()
        w.close()
        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, false)
        w.close()
        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, true)

        // The second close was a plain close, not the cancelled quit.
        expect(electron.quit).not.toHaveBeenCalled()
        expect(w.closed).toHaveBeenCalledTimes(1)

        const w2 = makeWindow()
        mod.guardWindowLeave(w2.win)
        fromRenderer(w2, IpcChannels.WINDOW_SET_UNSAVED, true)
        electron.appEvents.get('before-quit')!()
        w2.close()
        fromRenderer(w2, IpcChannels.WINDOW_LEAVE_DECIDED, true)
        expect(electron.quit).toHaveBeenCalledTimes(1)
    })

    it('lets the close go when the renderer is gone', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win)
        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)
        w.gone()
        expect(w.close()).toBe(false)
    })

    it('asks Leave / Stay on a reload, unless the user already chose to leave', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win)

        electron.showMessageBoxSync.mockReturnValue(1) // Stay
        expect(w.unload()).toBe(false)
        electron.showMessageBoxSync.mockReturnValue(0) // Leave
        expect(w.unload()).toBe(true)

        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)
        w.close()
        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, true)
        electron.showMessageBoxSync.mockClear()
        expect(w.unload()).toBe(true)
        expect(electron.showMessageBoxSync).not.toHaveBeenCalled()
    })

    it('routes the reload keys through the prompt when asked to', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win, { reloadKeys: true })
        expect(w.key({})).toBe(false) // nothing unsaved: reload as usual

        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)
        expect(w.key({ code: 'KeyA' })).toBe(false)
        expect(w.key({ control: false, meta: true, shift: true })).toBe(true)
        expect(w.send).toHaveBeenCalledWith(IpcEvents.WINDOW_LEAVE_REQUESTED)

        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, true)
        expect(w.reload).toHaveBeenCalledTimes(1)
        expect(w.closed).not.toHaveBeenCalled()
    })

    it('stays on a cancelled reload, and leaves the keys alone without the option', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win, { reloadKeys: true })
        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)
        w.key({})
        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, false)
        expect(w.reload).not.toHaveBeenCalled()

        const plain = makeWindow()
        mod.guardWindowLeave(plain.win)
        fromRenderer(plain, IpcChannels.WINDOW_SET_UNSAVED, true)
        expect(plain.key({})).toBe(false)
    })

    it('ignores a second answer to one leave', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win, { reloadKeys: true })
        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)
        w.key({})
        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, true)
        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, true)
        expect(w.reload).toHaveBeenCalledTimes(1)
        expect(w.closed).not.toHaveBeenCalled()
    })

    it('starts over on a fresh page', () => {
        const w = makeWindow()
        mod.guardWindowLeave(w.win, { reloadKeys: true })
        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)
        w.key({})
        fromRenderer(w, IpcChannels.WINDOW_LEAVE_DECIDED, true)

        w.loaded()

        expect(w.close()).toBe(false) // nothing unsaved on the new page
        fromRenderer(w, IpcChannels.WINDOW_SET_UNSAVED, true)
        expect(w.close()).toBe(true) // and the old Leave no longer counts
    })
})
