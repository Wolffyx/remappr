import type { ElectronIpcApi } from '../shared/ipc-types'

declare global {
    interface Window {
        api: ElectronIpcApi
    }
}
