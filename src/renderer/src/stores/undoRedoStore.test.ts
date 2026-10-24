import { describe, it, expect, beforeEach } from 'vitest'
import useUndoRedoStore from './undoRedoStore'

describe('undoRedoStore', () => {
    beforeEach(() => {
        useUndoRedoStore.getState().reset()
    })

    it('canUndo / canRedo are false on empty stacks', () => {
        const s = useUndoRedoStore.getState()
        expect(s.canUndo()).toBe(false)
        expect(s.canRedo()).toBe(false)
    })

    it('doIt pushes onto undoStack and clears redoStack', async () => {
        let value = 0
        await useUndoRedoStore.getState().doIt(async () => {
            value = 1
            return async () => {
                value = 0
            }
        })

        expect(value).toBe(1)
        const s = useUndoRedoStore.getState()
        expect(s.undoStack.length).toBe(1)
        expect(s.redoStack.length).toBe(0)
        expect(s.canUndo()).toBe(true)
    })

    it('undo invokes undo callback and moves entry to redoStack', async () => {
        let value = 0
        await useUndoRedoStore.getState().doIt(async () => {
            value = 1
            return async () => {
                value = 0
            }
        })

        await useUndoRedoStore.getState().undo()

        expect(value).toBe(0)
        const s = useUndoRedoStore.getState()
        expect(s.undoStack.length).toBe(0)
        expect(s.redoStack.length).toBe(1)
        expect(s.canRedo()).toBe(true)
    })

    it('redo replays do callback and pushes back onto undoStack', async () => {
        let value = 0
        const doCb = async (): Promise<() => Promise<void>> => {
            value = 1
            return async () => {
                value = 0
            }
        }
        await useUndoRedoStore.getState().doIt(doCb)
        await useUndoRedoStore.getState().undo()
        await useUndoRedoStore.getState().redo()

        expect(value).toBe(1)
        const s = useUndoRedoStore.getState()
        expect(s.undoStack.length).toBe(1)
        expect(s.redoStack.length).toBe(0)
    })

    it('undo / redo on empty stacks are silent no-ops', async () => {
        await useUndoRedoStore.getState().undo()
        await useUndoRedoStore.getState().redo()
        const s = useUndoRedoStore.getState()
        expect(s.undoStack.length).toBe(0)
        expect(s.redoStack.length).toBe(0)
    })

    it('queues a second edit fired while one is in flight (never drops it)', async () => {
        const order: string[] = []
        let release!: () => void
        const gate = new Promise<void>((r) => {
            release = r
        })

        const first = useUndoRedoStore.getState().doIt(async () => {
            order.push('first-start')
            await gate
            order.push('first-end')
            return async () => {}
        })
        // Fired while `first` is still awaiting its (slow) RPC — the old
        // locked-guard silently discarded this edit.
        const second = useUndoRedoStore.getState().doIt(async () => {
            order.push('second')
            return async () => {}
        })

        release()
        await Promise.all([first, second])
        expect(order).toEqual(['first-start', 'first-end', 'second'])
        expect(useUndoRedoStore.getState().undoStack.length).toBe(2)
    })

    it('canUndo stays stable while an op is in flight (no flicker)', async () => {
        await useUndoRedoStore.getState().doIt(async () => async () => {})
        expect(useUndoRedoStore.getState().canUndo()).toBe(true)

        let release!: () => void
        const gate = new Promise<void>((r) => {
            release = r
        })
        const inFlight = useUndoRedoStore.getState().doIt(async () => {
            await gate
            return async () => {}
        })
        // Old behavior: locked=true here made canUndo() false for the whole
        // device round-trip, greying the Header button on every edit.
        expect(useUndoRedoStore.getState().canUndo()).toBe(true)
        release()
        await inFlight
        expect(useUndoRedoStore.getState().undoStack.length).toBe(2)
    })

    it('a doCb that throws pushes nothing and keeps the chain alive', async () => {
        await useUndoRedoStore.getState().doIt(async () => {
            throw new Error('rpc failed')
        })
        expect(useUndoRedoStore.getState().undoStack.length).toBe(0)

        await useUndoRedoStore.getState().doIt(async () => async () => {})
        expect(useUndoRedoStore.getState().undoStack.length).toBe(1)
    })

    it('undo clicked while an edit is in flight pops that edit once it lands', async () => {
        let value = 0
        let release!: () => void
        const gate = new Promise<void>((r) => {
            release = r
        })
        const edit = useUndoRedoStore.getState().doIt(async () => {
            await gate
            value = 1
            return async () => {
                value = 0
            }
        })
        const undo = useUndoRedoStore.getState().undo()
        release()
        await Promise.all([edit, undo])
        // The queued undo ran AFTER the edit and reverted it.
        expect(value).toBe(0)
        expect(useUndoRedoStore.getState().undoStack.length).toBe(0)
        expect(useUndoRedoStore.getState().redoStack.length).toBe(1)
    })

    it('new doIt clears redoStack (preserveRedo=false)', async () => {
        const cb =
            async (): Promise<() => Promise<void>> =>
            async (): Promise<void> => {}
        await useUndoRedoStore.getState().doIt(cb)
        await useUndoRedoStore.getState().undo()
        expect(useUndoRedoStore.getState().redoStack.length).toBe(1)

        await useUndoRedoStore.getState().doIt(cb)

        expect(useUndoRedoStore.getState().redoStack.length).toBe(0)
    })

    it('reset drops ops queued for the old history and unblocks the new one', async () => {
        const ran: string[] = []
        // An op stuck on the device being left (its RPC never answers).
        void useUndoRedoStore
            .getState()
            .doIt(() => new Promise<never>(() => {}))
        const queued = useUndoRedoStore.getState().doIt(async () => {
            ran.push('old')
            return async () => {}
        })
        useUndoRedoStore.getState().reset()

        await useUndoRedoStore.getState().doIt(async () => {
            ran.push('new')
            return async () => {}
        })
        expect(ran).toEqual(['new'])
        expect(useUndoRedoStore.getState().undoStack.length).toBe(1)
        void queued
    })

    it('reset clears both stacks', async () => {
        await useUndoRedoStore.getState().doIt(async () => async () => {})
        useUndoRedoStore.getState().reset()

        const s = useUndoRedoStore.getState()
        expect(s.undoStack.length).toBe(0)
        expect(s.redoStack.length).toBe(0)
    })
})
