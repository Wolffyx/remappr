// pattern-check: skip — presentational summary card, single caller, no abstraction
import { KeyCapPreview } from '@/features/keymap/keyboard/KeyCapPreview'
import type { KeyPosition } from '@/features/keymap/keyboard/PhysicalLayoutCanvas'
import { CATEGORY_META } from '@/lib/keymap/keyCategory'

/** Inspector header card: tinted KeyButton preview + tap/hold + category + layer. */
export function SelectedKeyCard({
    info,
    layerName,
}: {
    info: KeyPosition
    layerName: string
}): JSX.Element {
    const category = CATEGORY_META[info.category ?? 'alpha']?.label
    return (
        <div className="mb-4 flex items-center gap-3 rounded-xl border bg-background p-3">
            <KeyCapPreview info={info} />
            <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-bold text-foreground">
                    {info.header}
                </div>
                <div className="truncate text-[11.5px] text-muted-foreground">
                    {category}
                </div>
                <div className="text-[11px] text-muted-foreground">
                    {layerName} layer
                </div>
            </div>
        </div>
    )
}
