// Pattern check: no GoF pattern (-) — rejected — presentational list of the device's controls with their binding summaries (the dock's empty state).
import type { JSX } from 'react'
import { bindingSummary } from '@/lib/devices/bindingSummary'
import { categoryAccent } from '@/lib/devices/deviceCategory'
import useDeviceEditorStore, {
    selectActiveBindings,
} from '../model/deviceEditorStore'

export function ControlList(): JSX.Element | null {
    const loaded = useDeviceEditorStore((s) => s.loaded)
    const bindings = useDeviceEditorStore(selectActiveBindings)
    const select = useDeviceEditorStore((s) => s.select)
    const profile = useDeviceEditorStore(
        (s) => s.profiles.find((p) => p.id === s.activeProfileId)?.name,
    )
    if (!loaded) return null
    return (
        <>
            <div className="p-4">
                <div className="text-[15px] font-bold">Controls</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                    Select one on the device or below
                    {profile ? ` · ${profile} profile` : ''}
                </div>
            </div>
            <div className="flex flex-col gap-0.5 px-2.5 pb-4">
                {loaded.model.controls.map((c) => {
                    const s = bindingSummary(c, bindings, loaded.index)
                    return (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => select(c.id)}
                            className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent"
                        >
                            <span
                                className="size-2 shrink-0 rounded-[3px]"
                                style={{ background: categoryAccent(s.cat) }}
                            />
                            <span className="w-[108px] shrink-0 truncate text-[12.5px] text-muted-foreground">
                                {c.name}
                            </span>
                            <span className="flex-1 truncate text-[12.5px] font-bold">
                                {s.text}
                            </span>
                        </button>
                    )
                })}
            </div>
        </>
    )
}
