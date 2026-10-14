// Pattern check: no GoF pattern (-) — rejected — presentational bar summarising the selected control with an Edit button (workspaces A and C).
import type { JSX } from 'react'
import { SquarePen } from 'lucide-react'
import { Button } from '@/ui/button'
import { bindingSummary } from '@/lib/devices/bindingSummary'
import { categoryAccent } from '@/lib/devices/deviceCategory'
import { KIND_LABEL } from '@/lib/devices/labels'
import { cn } from '@/lib/cn'
import useDeviceEditorStore, {
    selectActiveBindings,
} from '../model/deviceEditorStore'

export function SelectedInfoBar({
    onEdit,
    indent = false,
}: {
    onEdit: () => void
    /** Leave room for the profile colour rail on the left. */
    indent?: boolean
}): JSX.Element | null {
    const loaded = useDeviceEditorStore((s) => s.loaded)
    const selected = useDeviceEditorStore((s) => s.selected)
    const panelOpen = useDeviceEditorStore((s) => s.panelOpen)
    const pick = useDeviceEditorStore((s) => s.pick)
    const bindings = useDeviceEditorStore(selectActiveBindings)
    const profile = useDeviceEditorStore(
        (s) => s.profiles.find((p) => p.id === s.activeProfileId)?.name,
    )
    const c = loaded?.model.controls.find((x) => x.id === selected)
    if (!loaded || !c || panelOpen || pick) return null
    const sum = bindingSummary(c, bindings, loaded.index)
    return (
        <div
            className={cn(
                'fade-in absolute bottom-[18px] z-10 flex items-center gap-3 rounded-[11px] border border-border bg-card px-3.5 py-2.5 shadow-[0_8px_24px_-10px_rgba(0,0,0,.5)]',
                indent ? 'left-11' : 'left-[18px]',
            )}
        >
            <span
                className="size-[9px] rounded-[3px]"
                style={{ background: categoryAccent(sum.cat) }}
            />
            <span className="max-w-[220px] truncate text-[17px] font-extrabold">
                {sum.text}
            </span>
            <div className="text-xs">
                <div className="font-semibold">
                    {c.name}
                    {sum.sub ? ` · ${sum.sub}` : ''}
                </div>
                <div className="text-muted-foreground">
                    {KIND_LABEL[c.kind]}
                    {profile ? ` · ${profile} profile` : ''}
                </div>
            </div>
            <Button size="sm" onClick={onEdit}>
                <SquarePen className="size-3.5" /> Edit
            </Button>
        </div>
    )
}
