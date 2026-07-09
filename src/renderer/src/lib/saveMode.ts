// Pattern check: Decorator (Tier 2) — applied — permanent Proxy decorator over
// KeyboardService with a runtime mode flag; Tier-1 Strategy considered (two
// mode behaviors) but the object must keep the SAME KeyboardService interface
// and swap behavior in place — decoration, not algorithm selection.
//
// Save-mode controller: implements the user-facing "Auto-save" setting
// (userSettingsStore.autosave, Settings → Communication) for every firmware.
//
//   underlying 'automatic' (QMK / VIA / Vial / Keychron — fw writes instantly,
//   there is NO firmware-side autosave toggle; the VIA protocol is inherently
//   write-through):
//     manual mode → keymap/encoder edits stage client-side, flush on commit()
//     auto  mode → passthrough (the firmware's native behavior)
//
//   underlying 'manual' (ZMK / Remappr — fw stages on-device, explicit save):
//     manual mode → passthrough (the firmware's native behavior)
//     auto  mode → edits pass through, then commit() fires automatically,
//                   debounced, so every change is saved shortly after you
//                   make it
//
// The wrapper is applied ONCE at connect and never swapped: toggling the
// setting flips an internal flag (applySaveMode), so no reconnect-level work
// runs on toggle. capabilities.saveMode is derived per mode ('manual' shows
// Save/Discard, 'automatic' hides them and the Header shows the pulsing
// Auto-save indicator).
//
// Scope: keymap + encoder edits. Facade writes (rgb, dynamic entries, macros,
// advanced) stay immediate by design.
import { toast } from 'sonner'
import type { KeyboardService, EncoderApi } from '@firmware/service'
import type { KeyAction, KeyUpdate } from '@firmware/types'

const CONTROLS = Symbol('saveMode.controls')

// Debounce for ZMK/Remappr auto-commit: long enough to coalesce a paint-drag
// of edits into one settings-flash write, short enough to feel "instant".
const AUTO_COMMIT_DEBOUNCE_MS = 1_000

type StagedKeyOp = {
    kind: 'key'
    layerId: number
    position: number
    action: KeyAction
}
type StagedEncoderOp = {
    kind: 'encoder'
    layerId: number
    encoderIdx: number
    direction: 0 | 1
    action: KeyAction
}
type StagedOp = StagedKeyOp | StagedEncoderOp

interface SaveModeControls {
    target: KeyboardService
    isAuto: () => boolean
    /** Switch modes. Turning auto ON flushes staged edits first (throws on
     *  failure — caller reverts the setting). */
    setAuto: (auto: boolean) => Promise<void>
}

function controlsOf(service: KeyboardService): SaveModeControls | undefined {
    return (service as KeyboardService & { [CONTROLS]?: SaveModeControls })[
        CONTROLS
    ]
}

/** True when the service carries the save-mode controller. */
export function isSaveModeManaged(service: KeyboardService): boolean {
    return controlsOf(service) !== undefined
}

/** Underlying service (identity for unmanaged services). */
export function unwrapSaveMode(service: KeyboardService): KeyboardService {
    return controlsOf(service)?.target ?? service
}

/**
 * Apply the auto-save setting to a live managed service. No-op for unmanaged
 * services. Turning auto ON flushes staged edits first and rethrows on flush
 * failure so the caller can revert the setting.
 */
export async function applySaveMode(
    service: KeyboardService,
    auto: boolean,
): Promise<void> {
    const controls = controlsOf(service)
    if (!controls || controls.isAuto() === auto) return
    await controls.setAuto(auto)
}

/**
 * Wrap a service with the save-mode controller. Identity for saveMode 'none'
 * (mock — nothing to save) and read-only views. Never double-wraps.
 */
export function withSaveMode(
    service: KeyboardService,
    initialAuto: boolean,
): KeyboardService {
    const base = service.capabilities.saveMode
    if (
        base === 'none' ||
        service.capabilities.readOnly ||
        isSaveModeManaged(service)
    ) {
        return service
    }
    const underlyingAutomatic = base === 'automatic'

    let auto = initialAuto

    // Staging state (underlying automatic, manual mode). Last-wins queue.
    const queue = new Map<string, StagedOp>()
    const listeners = new Set<(pending: boolean) => void>()
    let lastPending = false
    const notify = (): void => {
        const pending = queue.size > 0
        if (pending === lastPending) return
        lastPending = pending
        for (const cb of listeners) cb(pending)
    }

    // Auto-commit state (underlying manual, auto mode).
    let commitTimer: ReturnType<typeof setTimeout> | null = null
    const cancelAutoCommit = (): void => {
        if (commitTimer) clearTimeout(commitTimer)
        commitTimer = null
    }
    const scheduleAutoCommit = (): void => {
        cancelAutoCommit()
        commitTimer = setTimeout(() => {
            commitTimer = null
            service.commit().catch((e: unknown) => {
                toast.error(
                    e instanceof Error
                        ? e.message
                        : 'Auto-save failed to write to the keyboard',
                )
            })
        }, AUTO_COMMIT_DEBOUNCE_MS)
    }

    const flushStaged = async (): Promise<void> => {
        const keyOps = [...queue.entries()].filter(
            (e): e is [string, StagedKeyOp] => e[1].kind === 'key',
        )
        if (keyOps.length > 0) {
            const updates: KeyUpdate[] = keyOps.map(([, op]) => ({
                layerId: op.layerId,
                position: op.position,
                action: op.action,
            }))
            try {
                await service.setKeys(updates)
                for (const [k] of keyOps) queue.delete(k)
            } finally {
                notify()
            }
        }
        const encOps = [...queue.entries()].filter(
            (e): e is [string, StagedEncoderOp] => e[1].kind === 'encoder',
        )
        try {
            for (const [k, op] of encOps) {
                await service.encoders!.setEncoder(
                    op.layerId,
                    op.encoderIdx,
                    op.direction,
                    op.action,
                )
                queue.delete(k)
            }
        } finally {
            notify()
        }
    }

    const setKey = async (
        layerId: number,
        position: number,
        action: KeyAction,
    ): Promise<void> => {
        if (underlyingAutomatic && !auto) {
            queue.set(`k:${layerId}:${position}`, {
                kind: 'key',
                layerId,
                position,
                action,
            })
            notify()
            return
        }
        await service.setKey(layerId, position, action)
        if (!underlyingAutomatic && auto) scheduleAutoCommit()
    }

    const setKeys = async (updates: KeyUpdate[]): Promise<void> => {
        if (underlyingAutomatic && !auto) {
            for (const u of updates) {
                queue.set(`k:${u.layerId}:${u.position}`, {
                    kind: 'key',
                    layerId: u.layerId,
                    position: u.position,
                    action: u.action,
                })
            }
            notify()
            return
        }
        await service.setKeys(updates)
        if (!underlyingAutomatic && auto) scheduleAutoCommit()
    }

    const commit = async (): Promise<void> => {
        cancelAutoCommit()
        if (underlyingAutomatic) {
            if (auto) return service.commit() // clears the fw pending flag
            return flushStaged()
        }
        return service.commit()
    }

    const discardChanges = async (): Promise<void> => {
        if (underlyingAutomatic) {
            // Staged edits never reached the device; dropping them IS the
            // discard. VIA's own discardChanges throws — never forward.
            queue.clear()
            notify()
            return
        }
        cancelAutoCommit()
        return service.discardChanges()
    }

    // Encoder facade mirroring setKey's mode behavior; stable identity.
    const encoders: EncoderApi | undefined = service.encoders
        ? {
              setEncoder: async (layerId, encoderIdx, direction, action) => {
                  if (underlyingAutomatic && !auto) {
                      queue.set(`e:${layerId}:${encoderIdx}:${direction}`, {
                          kind: 'encoder',
                          layerId,
                          encoderIdx,
                          direction,
                          action,
                      })
                      notify()
                      return
                  }
                  await service.encoders!.setEncoder(
                      layerId,
                      encoderIdx,
                      direction,
                      action,
                  )
                  if (!underlyingAutomatic && auto) scheduleAutoCommit()
              },
          }
        : undefined

    const controls: SaveModeControls = {
        target: service,
        isAuto: () => auto,
        setAuto: async (next: boolean): Promise<void> => {
            if (next === auto) return
            if (next && underlyingAutomatic && queue.size > 0) {
                await flushStaged() // throws → caller reverts the setting
            }
            if (!next) cancelAutoCommit()
            auto = next
        },
    }

    const overrides: Record<PropertyKey, unknown> = {
        [CONTROLS]: controls,
        encoders,
        setKey,
        setKeys,
        commit,
        discardChanges,
        hasPendingChanges: (): boolean =>
            underlyingAutomatic ? queue.size > 0 : service.hasPendingChanges(),
        refreshPendingChanges: async (): Promise<boolean> =>
            underlyingAutomatic
                ? queue.size > 0
                : service.refreshPendingChanges(),
        onPendingChangesChanged: (
            cb: (pending: boolean) => void,
        ): (() => void) => {
            if (underlyingAutomatic) {
                listeners.add(cb)
                return () => listeners.delete(cb)
            }
            return service.onPendingChangesChanged(cb)
        },
    }

    // Bound-method cache for stable identities across property reads.
    const bound = new Map<PropertyKey, unknown>()

    return new Proxy(service, {
        get(target, prop) {
            // capabilities is derived per mode, so the Header's saveMode read
            // flips the moment the setting changes — no service swap needed.
            if (prop === 'capabilities') {
                return {
                    ...target.capabilities,
                    saveMode: auto
                        ? ('automatic' as const)
                        : ('manual' as const),
                }
            }
            if (prop in overrides) return overrides[prop]
            const value = Reflect.get(target, prop)
            if (typeof value !== 'function') return value
            let fn = bound.get(prop)
            if (!fn) {
                fn = (value as (...args: unknown[]) => unknown).bind(target)
                bound.set(prop, fn)
            }
            return fn
        },
        has(target, prop) {
            return prop in overrides || prop in target
        },
    }) as KeyboardService
}
