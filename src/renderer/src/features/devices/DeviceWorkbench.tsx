// Pattern check: no GoF pattern (-) — rejected — presentational workbench: stage overlays (profile pill, labels toggle, default-layout banner, hint) around DeviceStage.
import { useState, type JSX, type ReactNode } from 'react'
import { Lightbulb, Ruler, X } from 'lucide-react'
import { Button } from '@/ui/button'
import { Segmented } from '@/ui/segmented'
import { cn } from '@/lib/cn'
import { profileAccent } from '@/lib/devices/deviceCategory'
import { FORM_LABEL } from '@/lib/devices/labels'
import { useFeatureAvailable } from '@/features/firmware/useFeatureAvailable'
import {
    AccentPill,
    LivePill,
} from '@/features/keymap/keyboard/stage/StageOverlays'
import useLiveViewStore from '@/stores/liveViewStore'
import useDeviceEditorStore, {
    selectActiveBindings,
} from './model/deviceEditorStore'
import useDeviceViewStore from './model/deviceViewStore'
import { useEditLayout } from './model/useEditLayout'
import { DeviceStage, type StageLabels } from './stage/DeviceStage'
import { hasCallout } from './stage/geometry'

const LABEL_OPTIONS: { value: StageLabels; label: string }[] = [
    { value: 'callouts', label: 'Labels' },
    { value: 'clean', label: 'Clean' },
]

function ProfilePill(): JSX.Element | null {
    const profiles = useDeviceEditorStore((s) => s.profiles)
    const activeId = useDeviceEditorStore((s) => s.activeProfileId)
    const i = profiles.findIndex((p) => p.id === activeId)
    if (i < 0) return null
    return (
        <AccentPill
            accent={profileAccent(i)}
            name={profiles[i]!.name}
            suffix="profile"
        />
    )
}

/** "This device didn't report a layout" — shown once per open, with a way to
 *  re-draw it in the Builder where that is possible. */
function DefaultedBanner({
    hid,
    form,
}: {
    hid?: string
    form: string
}): JSX.Element | null {
    const [open, setOpen] = useState(true)
    const editLayout = useEditLayout()
    if (!open) return null
    return (
        <div className="fade-in pointer-events-none absolute inset-x-[18px] top-[58px] z-[11] flex justify-center">
            <div className="pointer-events-auto flex max-w-[560px] items-center gap-[11px] rounded-lg border border-border bg-card py-[9px] pr-[9px] pl-[13px] shadow-[0_8px_24px_-10px_rgba(0,0,0,.5)]">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Lightbulb className="size-[15px]" />
                </span>
                <div className="flex-1 text-control leading-snug text-pretty">
                    <b>Default {form.toLowerCase()} layout.</b>{' '}
                    <span className="text-muted-foreground">
                        This device didn’t report a layout
                        {hid ? ` (${hid})` : ''}. Every input is shown —
                        positions are generic.
                    </span>
                </div>
                {editLayout && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        onClick={editLayout}
                    >
                        <Ruler className="size-3.5" /> Fix layout
                    </Button>
                )}
                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setOpen(false)}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                    <X className="size-3.5" />
                </button>
            </div>
        </div>
    )
}

function Hint({ children }: { children: ReactNode }): JSX.Element {
    return (
        <div className="pointer-events-none absolute inset-x-[18px] bottom-[18px] z-10 flex justify-center">
            <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                {children}
            </span>
        </div>
    )
}

export interface DeviceWorkbenchProps {
    /** Px the right dock covers (workspace B), so overlays stay clear of it. */
    dockWidth?: number
    /** Where the stage area ends (workspace A's sheet takes the bottom). */
    stageBottom?: string
    /** CSS inset of the stage inside its area. */
    stageInset?: string
    hint?: ReactNode
    /** What a click on a control (or the empty stage, null) does. */
    onSelect?: (id: string | null) => void
    children?: ReactNode
}

/** The stage area of the device editor; workspaces add their panels as children. */
export function DeviceWorkbench({
    dockWidth = 0,
    stageBottom = '0',
    stageInset,
    hint,
    onSelect,
    children,
}: DeviceWorkbenchProps): JSX.Element {
    const editable = useFeatureAvailable('controlsEditable')
    const loaded = useDeviceEditorStore((s) => s.loaded)
    const status = useDeviceEditorStore((s) => s.status)
    const error = useDeviceEditorStore((s) => s.error)
    const bindings = useDeviceEditorStore(selectActiveBindings)
    const selected = useDeviceEditorStore((s) => s.selected)
    const storeSelect = useDeviceEditorStore((s) => s.select)
    const select = onSelect ?? storeSelect
    const labels = useDeviceViewStore((s) => s.labels)
    const setLabels = useDeviceViewStore((s) => s.setLabels)
    const liveFeature = useFeatureAvailable('controlsLive')
    const live = useLiveViewStore((s) => s.enabled) && liveFeature
    const model = loaded?.model
    const banner = !!model?.defaulted

    // `isolate` keeps the stage's own z-scale (the sheet and dock at 80, the
    // palette at 85) inside this box, so a dialog or tooltip portalled to the
    // body at z-50 still opens over them.
    return (
        <main className="workbench-bg relative isolate min-h-0 min-w-0 flex-1 overflow-hidden">
            <div
                className="pointer-events-none absolute top-3.5 left-0 z-10 flex items-center justify-between px-[18px] transition-[right] duration-200"
                style={{ right: dockWidth }}
            >
                <div className="pointer-events-auto flex items-center gap-2.5">
                    <ProfilePill />
                    {live && <LivePill />}
                </div>
                {model?.controls.some(hasCallout) && (
                    <div className="pointer-events-auto">
                        <Segmented
                            value={labels}
                            options={LABEL_OPTIONS}
                            onChange={setLabels}
                        />
                    </div>
                )}
            </div>
            {banner && model && (
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{ right: dockWidth }}
                >
                    <DefaultedBanner
                        hid={model.hidSummary}
                        form={FORM_LABEL[model.form]}
                    />
                </div>
            )}
            {status === 'error' && (
                <Hint>Could not read the device: {error}</Hint>
            )}
            {model && loaded && (
                <div
                    className="absolute inset-0 transition-[bottom] duration-200"
                    style={{ right: dockWidth, bottom: stageBottom }}
                >
                    <DeviceStage
                        model={model}
                        bindings={bindings}
                        index={loaded.index}
                        selected={selected}
                        onSelect={select}
                        labels={labels}
                        live={live}
                        className={cn(
                            stageInset ??
                                (banner
                                    ? 'inset-[110px_0_56px]'
                                    : 'inset-[60px_0_56px]'),
                        )}
                    />
                </div>
            )}
            {!selected && status === 'ready' && (
                <Hint>
                    {hint ??
                        (editable
                            ? 'Click a control to remap it'
                            : 'Click a control to see what it sends')}
                </Hint>
            )}
            {children}
        </main>
    )
}
