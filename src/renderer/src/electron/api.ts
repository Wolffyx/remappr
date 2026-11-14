// pattern-check: skip shared window-bridge accessors consolidated from 4 duplicate component-local copies
// Single source for reaching the context-bridged Electron API + platform from
// the renderer. Previously each of TitleBar/WindowControls/UpdateNotification/
// AboutSection redeclared its own `ElectronWindow` + `getApi`/`getPlatform`.
import type { ElectronIpcApi } from '@shared/ipc-types'

interface ElectronWindow {
    api?: ElectronIpcApi
}

/** The context-bridged IPC API, or undefined outside Electron (e.g. the web build). */
export function getApi(): ElectronIpcApi | undefined {
    return (window as unknown as ElectronWindow).api
}

/** Host platform string (e.g. 'darwin'/'win32'/'linux'), or undefined
 *  outside Electron. */
export function getPlatform(): string | undefined {
    return getApi()?.platform
}
