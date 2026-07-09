// Pattern check: no GoF pattern (-) — rejected — a static neutral-id → Lucide
// component lookup table plus two pure helpers; presentational data map, no
// abstraction or polymorphic family.
//
// The renderer half of the icon-legend system (issue #147). The firmware layer
// tags behaviors / commands with NEUTRAL string icon ids (see the shared
// vocabulary in @firmware/legendIcons and the per-adapter maps); this registry
// resolves an id to the concrete Lucide component. An id with no entry resolves
// to undefined, and the caller falls back to the part's text — so the firmware
// can name an icon before the registry learns it without breaking the cap.
import type { LucideIcon } from 'lucide-react'
import {
    ArrowDown,
    ArrowLeft,
    ArrowLeftRight,
    ArrowRight,
    ArrowUp,
    Battery,
    Bluetooth,
    Camera,
    CaseUpper,
    ChevronsDown,
    ChevronsLeft,
    ChevronsRight,
    ChevronsUp,
    Eraser,
    HardDriveDownload,
    Lightbulb,
    Lock,
    LockOpen,
    Mouse,
    MouseLeft,
    MousePointerClick,
    MouseRight,
    Move,
    PlugZap,
    Power,
    PowerOff,
    Rainbow,
    Repeat,
    RotateCcw,
    SkipBack,
    SkipForward,
    ToggleLeft,
    Trash2,
    Unlink,
    Usb,
    Wifi,
} from 'lucide-react'
import type { LegendPart } from '@firmware/paramLabel'

const LEGEND_ICONS: Readonly<Record<string, LucideIcon>> = {
    bluetooth: Bluetooth,
    next: SkipForward,
    prev: SkipBack,
    clear: Eraser,
    'clear-all': Trash2,
    disconnect: Unlink,
    output: ArrowLeftRight,
    usb: Usb,
    ble: Bluetooth,
    wireless: Wifi,
    underglow: Rainbow,
    backlight: Lightbulb,
    power: PlugZap,
    'power-off': PowerOff,
    toggle: ToggleLeft,
    on: Power,
    off: PowerOff,
    reset: RotateCcw,
    bootloader: HardDriveDownload,
    'caps-word': CaseUpper,
    'key-repeat': Repeat,
    unlock: LockOpen,
    battery: Battery,
    lock: Lock,
    screenshot: Camera,
    mouse: Mouse,
    'mouse-button': MousePointerClick,
    'mouse-left': MouseLeft,
    'mouse-right': MouseRight,
    'mouse-move': Move,
    'mouse-scroll': Mouse,
    'arrow-up': ArrowUp,
    'arrow-down': ArrowDown,
    'arrow-left': ArrowLeft,
    'arrow-right': ArrowRight,
    'scroll-up': ChevronsUp,
    'scroll-down': ChevronsDown,
    'scroll-left': ChevronsLeft,
    'scroll-right': ChevronsRight,
}

/** Resolve a neutral icon id to its Lucide component, or undefined if unknown. */
export function legendIcon(id?: string): LucideIcon | undefined {
    return id ? LEGEND_ICONS[id] : undefined
}

/** True when at least one part renders as an icon (the rest as text). */
export function hasResolvableIcon(parts?: LegendPart[]): boolean {
    return !!parts?.some((p) => legendIcon(p.icon))
}

/** Sizing weight for the cap type-ramp: a resolvable icon counts ~2 chars, each
 *  other part its text length. Mirrors how KeyButton sizes off tapText length. */
export function legendPartsLength(parts: LegendPart[]): number {
    return parts.reduce(
        (n, p) => n + (legendIcon(p.icon) ? 2 : p.text.length),
        0,
    )
}
