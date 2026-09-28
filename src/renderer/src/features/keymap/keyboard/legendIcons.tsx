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
    Play,
    PlugZap,
    Power,
    PowerOff,
    Rainbow,
    Repeat,
    RotateCcw,
    SkipBack,
    SkipForward,
    Sun,
    SunDim,
    ToggleLeft,
    Trash2,
    Unlink,
    Usb,
    Volume1,
    Volume2,
    VolumeX,
    Wifi,
} from 'lucide-react'
import type { LegendPart } from '@firmware/paramLabel'
import { hidUsagePageAndIdFromUsage } from '@/lib/actions/hidUsages'

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
    'volume-up': Volume2,
    'volume-down': Volume1,
    mute: VolumeX,
    play: Play,
    'brightness-up': Sun,
    'brightness-down': SunDim,
}

// Plain HID media usages carry no behavior icon from the firmware (they are just
// a usage), so the renderer names them here. Keyed `page:id`; only an unmodified
// usage (no chord mods in the high byte) maps to an icon.
const USAGE_ICONS: Readonly<Record<string, string>> = {
    // Consumer page (0x0C)
    '12:233': 'volume-up', // 0xE9 Volume Increment
    '12:234': 'volume-down', // 0xEA Volume Decrement
    '12:226': 'mute', // 0xE2 Mute
    '12:205': 'play', // 0xCD Play/Pause
    '12:181': 'next', // 0xB5 Scan Next Track
    '12:182': 'prev', // 0xB6 Scan Previous Track
    '12:111': 'brightness-up', // 0x6F Display Brightness Increment
    '12:112': 'brightness-down', // 0x70 Display Brightness Decrement
    // Keyboard page (0x07) volume keys
    '7:128': 'volume-up', // 0x80 Keyboard Volume Up
    '7:129': 'volume-down', // 0x81 Keyboard Volume Down
    '7:127': 'mute', // 0x7F Keyboard Mute
}

/** Neutral icon id for a plain HID usage (media keys), or undefined. */
export function hidUsageIcon(usage?: number): string | undefined {
    if (usage == null) return undefined
    const [pageRaw, id] = hidUsagePageAndIdFromUsage(usage)
    if (pageRaw >> 8) return undefined // chord mods → not a plain media key
    return USAGE_ICONS[`${pageRaw & 0xff}:${id}`]
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
