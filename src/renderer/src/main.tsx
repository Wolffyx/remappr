import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { silenceConsoleInProduction } from '@shared/logger.ts'
// Firmware clients (ZMK / QMK / Vial / Keychron / Remappr / mock) auto-register
// themselves, code-split one chunk per client — see firmwareClients.ts. Connect
// actions await the load; Remappr's HID-filter precedence no longer depends on
// import order (discovery.ts pins it by priority).
import { ensureFirmwareClientsLoaded } from '@/transport/adapter/firmwareClients'
import './index.css'

silenceConsoleInProduction()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)

// Warm the per-client chunks just after first paint — non-blocking, so initial
// render isn't held up. Connect paths await the same memoized promise, so this
// is purely a latency optimization; failures surface there, not here.
void ensureFirmwareClientsLoaded()
