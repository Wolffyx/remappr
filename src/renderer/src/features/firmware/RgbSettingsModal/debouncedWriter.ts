// Pattern check: no GoF pattern (-) — rejected — a debounced writer that
// remembers the last value the device took; one small class, testable with
// fake timers.
//
// A slider drag sends at most one write per `delayMs`, and only the latest
// value. When the device refuses a write, `onRejected` gets the last value it
// took, so the UI can go back to what the device really shows. A newer value
// queued meanwhile wins: it is sent next, and nothing rolls back over it.

export interface DebouncedWriterOptions<T> {
    write: (value: T) => Promise<unknown>
    onRejected: (lastAccepted: T | null, error: unknown) => void
    delayMs: number
}

export class DebouncedWriter<T> {
    private pending: T | null = null
    private timer: ReturnType<typeof setTimeout> | null = null
    private accepted: T | null = null
    private inFlight = 0

    constructor(private readonly opts: DebouncedWriterOptions<T>) {}

    /** The device holds `value` (read from it, or written). */
    accept(value: T): void {
        this.accepted = value
    }

    /** Queue `value`; it goes out after the debounce. */
    set(value: T): void {
        this.pending = value
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => void this.flush(), this.opts.delayMs)
    }

    /** Send the queued value now (on close). Resolves once it is settled. */
    async flush(): Promise<void> {
        if (this.timer) clearTimeout(this.timer)
        this.timer = null
        const next = this.pending
        this.pending = null
        if (next === null) return
        this.inFlight += 1
        try {
            await this.opts.write(next)
            this.accepted = next
        } catch (e) {
            // A newer value is queued or on its way: it replaces this one.
            if (this.pending === null && this.inFlight === 1) {
                this.opts.onRejected(this.accepted, e)
            }
        } finally {
            this.inFlight -= 1
        }
    }
}
