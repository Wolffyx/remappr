// Pattern check: Template Method (Tier 1) — applied — base class owns AbortController + label state; subclasses implement connect()
import type { Transport } from '@firmware'

/**
 * Common base for any adapter that produces a {@link Transport}. Holds the
 * abort controller + label so subclasses don't re-declare them. The
 * `connect()` method is intentionally abstract — IPC adapters and browser
 * adapters share no useful body, so the template lives one level deeper
 * (see {@link IpcTransportAdapter}).
 */
export abstract class TransportAdapter {
    protected readonly abortController = new AbortController()
    protected label = 'Unknown device'

    abstract connect(): Promise<Transport>
}
