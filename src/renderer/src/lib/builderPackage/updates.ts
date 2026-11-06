// Pattern check: Observer (Tier 1) — applied — background delivery publishes
// what it found; the toast component subscribes, so delivery stays UI-free.
//
// What the builder delivery tells the user about (plan §6c B):
// - "ready": a newer builder was downloaded; it opens next time.
// - "needs-host": a newer builder exists, but only for a newer app.

export type BuilderUpdate =
    | { kind: 'ready'; version: string; changelog: string }
    | { kind: 'needs-host'; version: string }

type Listener = (update: BuilderUpdate) => void

const listeners = new Set<Listener>()

/** Subscribe; returns the unsubscribe function. */
export function onBuilderUpdate(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function announceBuilderUpdate(update: BuilderUpdate): void {
    for (const listener of listeners) listener(update)
}
