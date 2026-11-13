// Pattern check: no GoF pattern (-) — rejected — presentational min/max/close buttons
// wired straight to the existing window-control IPC; extracted from TitleBar so the
// editor header and start page can both host them. No abstraction warranted.
import { Copy, Minus, Square, X } from 'lucide-react'
import { IpcChannels } from '../../../shared/ipc-types'
import { getApi, getPlatform } from '@/electron/api'
import { useWindowMaximized } from '@/hooks/use-window-maximized'

/**
 * Native window min/max/close controls for the custom (frameless) Electron titlebar.
 * Renders nothing outside Electron or on macOS (which keeps its native traffic lights).
 * Buttons opt out of the drag region via WebkitAppRegion: 'no-drag'.
 */
export function WindowControls(): JSX.Element | null {
    const api = getApi()
    const platform = getPlatform()
    // Tracks OS-side maximize/restore too (double-click, snap) — the icon used
    // to go stale because the state was only read once on mount.
    const maximized = useWindowMaximized()

    if (!api || platform === 'darwin') return null

    const onMin = (): void => {
        void api.invoke(IpcChannels.WINDOW_MINIMIZE)
    }
    const onMaxToggle = (): void => {
        // The resize triggered by the toggle re-queries the state via
        // useWindowMaximized — no local bookkeeping needed.
        void api.invoke(IpcChannels.WINDOW_MAXIMIZE_TOGGLE)
    }
    // With unsaved device edits, main holds the close and the in-app
    // Save / Discard / Cancel prompt decides (windowLeaveGuard).
    const onClose = (): void => {
        void api.invoke(IpcChannels.WINDOW_CLOSE)
    }

    return (
        <div
            className="flex h-full items-stretch"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            <button
                type="button"
                onClick={onMin}
                className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Minimize"
            >
                <Minus className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onClick={onMaxToggle}
                className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={maximized ? 'Restore' : 'Maximize'}
            >
                {maximized ? (
                    <Copy className="h-3.5 w-3.5 -scale-x-100" />
                ) : (
                    <Square className="h-3 w-3" />
                )}
            </button>
            <button
                type="button"
                onClick={onClose}
                className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Close"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}
