// Pattern check: no GoF pattern (-) — rejected — presentational: the generic controllers and mice as device tiles, plus the press-a-button hint the Gamepad API needs.
import type { JSX } from 'react'
import { Gamepad2 } from 'lucide-react'
import type { GenericInputDevice } from '@firmware/generic'
import { DeviceTile } from '@/features/devices/DeviceTile'

interface InputDeviceGridProps {
    devices: readonly GenericInputDevice[]
    /** Show the "press a button" hint (the browser can see controllers). */
    gamepadHint: boolean
    onOpen: (device: GenericInputDevice) => void
}

/** Controllers and mice with no vendor protocol: view and live test only. */
export function InputDeviceGrid({
    devices,
    gamepadHint,
    onOpen,
}: InputDeviceGridProps): JSX.Element | null {
    if (devices.length === 0 && !gamepadHint) return null
    return (
        <div className="space-y-2.5">
            {devices.length > 0 && (
                <>
                    <div className="flex items-baseline justify-between gap-3 pt-1">
                        <span className="text-caption font-bold tracking-[.08em] text-muted-foreground uppercase">
                            Controllers &amp; mice
                        </span>
                        <span className="text-xs text-muted-foreground">
                            View and live test · no vendor protocol
                        </span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-2.5">
                        {devices.map((d) => (
                            <DeviceTile
                                key={d.id}
                                name={d.name}
                                model={d.preview.model}
                                bindings={d.preview.bindings}
                                catalog={d.preview.catalog}
                                summary={d.summary}
                                onPick={() => onOpen(d)}
                            />
                        ))}
                    </div>
                </>
            )}
            {gamepadHint && (
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                    <Gamepad2 className="size-3.5 shrink-0" />
                    Controller not listed? Press any button on it.
                </p>
            )}
        </div>
    )
}
