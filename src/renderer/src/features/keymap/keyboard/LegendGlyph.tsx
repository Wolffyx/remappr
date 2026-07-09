// Pattern check: no GoF pattern (-) — rejected — a stable presentational wrapper
// resolving a neutral icon id to an element; no abstraction or polymorphism.
//
// Kept in its own file so the icon registry (legendIcons.tsx) stays a
// functions-only module (react-refresh) while call sites get a terse
// `<LegendGlyph id={...}/>`. Uses createElement rather than a render-scoped
// `<Icon/>` tag so it satisfies react-hooks/static-components.
import { createElement, type CSSProperties } from 'react'
import { legendIcon } from './legendIcons'

export function LegendGlyph({
    id,
    className,
    style,
}: {
    id?: string
    className?: string
    style?: CSSProperties
}): JSX.Element | null {
    const icon = legendIcon(id)
    return icon ? createElement(icon, { className, style }) : null
}
