// Pattern check: no GoF pattern (-) — rejected — one presentational component
// rendering a composite icon+text legend; per-part icon-or-text swap, no
// abstraction warranted.
//
// The cap legend for a behavior/command with icons (issue #147). Each part
// renders its Lucide icon when the id resolves, otherwise its text (the
// per-part fallback); empty-text icon-less parts render nothing. Icons are sized
// in `em` so they scale with the legend font-size KeyButton computes, mirroring
// keyGlyph.tsx. Shared by the editor stage and the layout preview. `title`
// carries the full readable value for the native tooltip.
import type { LegendPart } from '@firmware/paramLabel'
import { legendIcon } from './legendIcons'

export function LegendParts({
    parts,
    title,
}: {
    parts: LegendPart[]
    title?: string
}): JSX.Element {
    return (
        <span
            className="inline-flex items-center justify-center gap-[0.12em] w-full leading-none overflow-hidden"
            title={title}
        >
            {parts.map((part, i) => {
                const Icon = legendIcon(part.icon)
                if (Icon) {
                    return (
                        <Icon
                            key={i}
                            aria-label={part.text || undefined}
                            strokeWidth={2.25}
                            style={{ width: '1.05em', height: '1.05em' }}
                        />
                    )
                }
                if (!part.text) return null
                return (
                    <span
                        key={i}
                        className="font-bold overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                        {part.text}
                    </span>
                )
            })}
        </span>
    )
}
