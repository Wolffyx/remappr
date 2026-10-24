// Pattern check: Command (Tier 2) — extended — keeps the existing Do/Undo
// callback pairs (Command objects with execute/undo); this change only swaps
// the concurrency guard from a drop-edits lock to promise-chain serialization.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type UndoCallback = () => Promise<void>
export type DoCallback = () => Promise<UndoCallback>

interface UndoRedoState {
    undoStack: Array<[DoCallback, UndoCallback]>
    redoStack: Array<DoCallback>
    canUndo: () => boolean
    canRedo: () => boolean
    doIt: (doCb: DoCallback, preserveRedo?: boolean) => Promise<void>
    undo: () => Promise<void>
    redo: () => Promise<void>
    reset: () => void
}

const useUndoRedoStore = create<UndoRedoState>()(
    devtools((set, get) => {
        // Ops are SERIALIZED on a promise chain instead of guarded by a lock:
        // a second edit arriving while one is in flight is queued, never
        // silently dropped, and canUndo/canRedo don't flicker for the duration
        // of a device RPC (the old `locked` flag disabled the Header buttons
        // for the whole setKey round-trip). A doCb that throws aborts its op
        // (nothing is pushed) without breaking the chain — the caller has
        // already surfaced the error and reverted its optimistic state.
        let chain: Promise<void> = Promise.resolve()
        // Bumped by reset() (a device switch, a discard): ops queued before
        // it belong to the history it threw away and are skipped, and the new
        // history starts its own chain, so an op stuck on the device left
        // behind can't hold up the next one's edits.
        let generation = 0
        const enqueue = (op: () => Promise<void>): Promise<void> => {
            const queuedIn = generation
            const run = async (): Promise<void> => {
                if (queuedIn !== generation) return
                try {
                    await op()
                } catch (e) {
                    console.error('undoRedo op failed', e)
                }
            }
            chain = chain.then(run, run)
            return chain
        }

        return {
            undoStack: [],
            redoStack: [],

            canUndo: () => get().undoStack.length > 0,
            canRedo: () => get().redoStack.length > 0,

            doIt: (doCb, preserveRedo = false) =>
                enqueue(async () => {
                    const undo = await doCb()
                    set((state) => ({
                        undoStack: [[doCb, undo], ...state.undoStack],
                    }))
                    if (!preserveRedo) {
                        set({ redoStack: [] })
                    }
                }),

            // Stacks are read at RUN time (inside the queued op), not at call
            // time — an undo clicked while an edit is still in flight pops the
            // entry that edit pushed, not a stale snapshot.
            undo: () =>
                enqueue(async () => {
                    const { undoStack, redoStack } = get()
                    if (undoStack.length === 0) return
                    const [doCb, undoCb] = undoStack[0]
                    set({
                        undoStack: undoStack.slice(1),
                        redoStack: [doCb, ...redoStack],
                    })
                    await undoCb()
                }),

            redo: () =>
                enqueue(async () => {
                    const { redoStack } = get()
                    if (redoStack.length === 0) return
                    const doCb = redoStack[0]
                    set({ redoStack: redoStack.slice(1) })
                    const undo = await doCb()
                    set((state) => ({
                        undoStack: [[doCb, undo], ...state.undoStack],
                    }))
                }),

            reset: () => {
                generation++
                chain = Promise.resolve()
                set({ redoStack: [], undoStack: [] })
            },
        }
    }),
)

export default useUndoRedoStore
