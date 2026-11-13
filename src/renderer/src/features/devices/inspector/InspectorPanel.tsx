// Pattern check: no GoF pattern (-) — rejected — wires the selected control from the editor store into the presentational ControlInspector, with its header and reset.
import type { JSX } from 'react'
import { Crosshair, RotateCcw, SlidersHorizontal, Tag, X } from 'lucide-react'
import { bindingOf, defaultBinding } from '@firmware/devices/defaults'
import type { DeviceControl } from '@firmware/devices/types'
import { Button } from '@/ui/button'
import { useFeatureAvailable } from '@/features/firmware/useFeatureAvailable'
import { summarizeBinding } from '@/lib/devices/bindingSummary'
import { categoryAccent } from '@/lib/devices/deviceCategory'
import { KIND_LABEL } from '@/lib/devices/labels'
import useLiveViewStore from '@/stores/liveViewStore'
import { useBindingMutations } from '../model/bindingMutations'
import useDeviceEditorStore, {
    selectActiveBindings,
} from '../model/deviceEditorStore'
import { useControlAnalog } from '../model/liveInputStore'
import { ControlInspector } from './ControlInspector'

function KindIcon({ c }: { c: DeviceControl }): JSX.Element {
    if (c.glyph) return <>{c.glyph}</>
    if (c.kind === 'sensor') return <Crosshair className="size-[17px]" />
    if (c.kind === 'button') return <Tag className="size-[17px]" />
    return <SlidersHorizontal className="size-[17px]" />
}

export interface InspectorPanelProps {
    /** Sections in columns, reset in the header (workspace A's sheet). */
    wide?: boolean
    onClose: () => void
}

/** The selected control's settings, or nothing when none is selected. */
export function InspectorPanel({
    wide = false,
    onClose,
}: InspectorPanelProps): JSX.Element | null {
    const loaded = useDeviceEditorStore((s) => s.loaded)
    const selected = useDeviceEditorStore((s) => s.selected)
    const bindings = useDeviceEditorStore(selectActiveBindings)
    const profile = useDeviceEditorStore(
        (s) => s.profiles.find((p) => p.id === s.activeProfileId)?.name,
    )
    const setPick = useDeviceEditorStore((s) => s.setPick)
    const editable = useFeatureAvailable('controlsEditable')
    const liveOn = useLiveViewStore((s) => s.enabled)
    const liveFeature = useFeatureAvailable('controlsLive')
    const live = liveOn && liveFeature
    const analog = useControlAnalog(selected ?? '', live)
    const { patch, replace } = useBindingMutations()
    const c = loaded?.model.controls.find((x) => x.id === selected)
    if (!loaded || !c) return null

    const binding = bindingOf(c, bindings, loaded.index.catalog)
    const sum = summarizeBinding(c, binding, loaded.index)
    const accent = categoryAccent(sum.cat)
    const reset = (): void =>
        replace(c.id, defaultBinding(c.kind, loaded.index.catalog))
    const resetButton = editable ? (
        <Button
            variant="secondary"
            size="sm"
            onClick={reset}
            className={wide ? '' : 'w-full'}
        >
            <RotateCcw className="size-3.5" /> Reset to default
        </Button>
    ) : null

    return (
        <div key={c.id} className="fade-in">
            <div
                className={
                    wide
                        ? 'flex items-center gap-3 px-[18px] pt-2.5 pb-3'
                        : 'flex items-center gap-3 p-4'
                }
            >
                <span
                    className="grid h-10 min-w-10 place-items-center rounded-lg border px-2 font-mono text-panel-title font-bold"
                    style={{
                        background: `color-mix(in oklab, ${accent} 18%, var(--card))`,
                        borderColor: `color-mix(in oklab, ${accent} 50%, transparent)`,
                        color: accent,
                    }}
                >
                    <KindIcon c={c} />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">
                        {c.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                        {KIND_LABEL[c.kind]}
                        {profile ? ` · ${profile} profile` : ''}
                        {editable ? '' : ' · read-only'}
                    </div>
                </div>
                {wide ? resetButton : null}
                <button
                    type="button"
                    aria-label="Close"
                    onClick={onClose}
                    className="grid size-[30px] place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                    <X className="size-3.5" />
                </button>
            </div>
            <ControlInspector
                control={c}
                binding={binding}
                index={loaded.index}
                form={loaded.model.form}
                editable={editable}
                live={live}
                analog={analog}
                onPatch={(p) => patch(c.id, p)}
                onPick={(field, title) => setPick({ field, title })}
                wide={wide}
            />
            {!wide && resetButton ? (
                <div className="border-t border-border px-4 pt-3.5 pb-5">
                    {resetButton}
                </div>
            ) : null}
        </div>
    )
}
