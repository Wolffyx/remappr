// pattern-check: skip — presentational chip; category tint comes from the
// existing catStyle() lookup, no new logic/abstraction.
import { CSSProperties, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import type { ColorMode } from '@/lib/keymap/keyCategory'
import { categoryForUsage, catStyle } from '@/lib/keymap/keyCategory'
import { LegendGlyph } from '@/features/keymap/keyboard/LegendGlyph'

// pattern-check: skip — additive optional icon prop + presentational glyph render
interface KeycodeButtonProps {
    value?: number
    label: string
    name?: string
    /** Neutral icon id shown before the label (e.g. a mouse-cursor arrow). */
    icon?: string
    /** The connected firmware's own names for the key (its codec's). */
    names?: readonly string[]
    notes?: string
    baseKeyValue?: number
    colorMode?: ColorMode
    onSelect: (keyCode: number) => void
    // Bypass the value/onSelect path. Used by behavior-ref tiles
    // (ZMK runtime &macro_* / &combo_*) which emit a complete
    // KeyAction rather than a codec-encoded number.
    onClickOverride?: () => void
    isSelected?: boolean
}

export default function KeycodeButton({
    value,
    label,
    name,
    icon,
    names: firmwareNames,
    notes,
    baseKeyValue,
    colorMode = 'subtle',
    onSelect,
    onClickOverride,
    isSelected = false,
}: KeycodeButtonProps): JSX.Element {
    const [hovered, setHovered] = useState(false)

    // Full category-tinted face (gradient + legend colour), matching the
    // design handoff's KcButton. Neutral categories (alpha/space) fall back
    // to --secondary so letters read as plain caps.
    const cat = value && value !== 0 ? categoryForUsage(value) : 'alpha'
    const cs = catStyle(cat, colorMode)
    const tinted = !!cs.face

    const tintedBorder = `color-mix(in oklab, ${cs.edge} 40%, transparent)`
    const restingBorder = isSelected
        ? 'var(--primary)'
        : tinted
          ? tintedBorder
          : 'var(--border)'

    const style: CSSProperties = {
        minWidth: 44,
        height: 42,
        padding: '0 10px',
        borderRadius: 8,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        fontWeight: 600,
        fontSize: 13,
        fontFamily:
            cat === 'alpha'
                ? 'var(--font-keycap, Inter, sans-serif)'
                : 'var(--font-mono, "JetBrains Mono", monospace)',
        background: tinted
            ? `linear-gradient(180deg, ${cs.faceTop}, ${cs.face})`
            : 'var(--secondary)',
        border: `1px solid ${hovered || isSelected ? 'var(--primary)' : restingBorder}`,
        color: tinted ? cs.legend : 'var(--foreground)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: isSelected
            ? '0 0 0 1px var(--primary), 0 0 0 4px color-mix(in oklab, var(--primary) 25%, transparent)'
            : 'none',
        transition: 'transform .12s ease, border-color .12s ease',
    }

    const handleClick = (): void => {
        if (onClickOverride) {
            onClickOverride()
            return
        }
        if (value !== undefined) onSelect(value)
    }

    const namesLine = firmwareNames?.length ? firmwareNames.join(' · ') : null

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-pressed={isSelected}
                    style={style}
                    value={value}
                    data-base-key-value={baseKeyValue}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    onClick={handleClick}
                >
                    <span className="inline-flex items-center gap-1.5">
                        {icon && (
                            <LegendGlyph
                                id={icon}
                                className="h-4 w-4 shrink-0"
                            />
                        )}
                        {label}
                    </span>
                </button>
            </TooltipTrigger>
            <TooltipContent>
                <div className="font-medium">{name ?? label}</div>
                {name && name !== label ? (
                    <div className="text-xs opacity-70">{label}</div>
                ) : null}
                {namesLine ? (
                    <div className="text-xs mt-1 opacity-80">
                        In firmware:{' '}
                        <span className="font-mono">{namesLine}</span>
                    </div>
                ) : null}
                {notes ? (
                    <div className="text-xs mt-1 italic opacity-70">
                        {notes}
                    </div>
                ) : null}
            </TooltipContent>
        </Tooltip>
    )
}
