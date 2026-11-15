// pattern-check: skip — shared constant: the editors' sidebar CSS variables.
import type { CSSProperties } from 'react'

// Hoisted so it's a stable reference — an inline object here makes a fresh ref
// every render, forcing the whole editor subtree to re-render on any
// connection/lock-state change.
export const SIDEBAR_STYLE = {
    '--sidebar-width': '15.5rem',
    '--header-height': 'calc(var(--spacing) * 13)',
    '--footer-height': 'calc(var(--spacing) * 8)',
} as CSSProperties
