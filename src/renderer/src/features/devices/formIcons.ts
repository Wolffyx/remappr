// pattern-check: skip — pure data: lucide icon per device form.
import {
    Gamepad2,
    Grid3x3,
    Joystick,
    Keyboard,
    Mouse,
    type LucideIcon,
} from 'lucide-react'
import type { DeviceForm } from '@firmware/devices/types'

export const FORM_ICON: Readonly<Record<DeviceForm, LucideIcon>> = {
    keyboard: Keyboard,
    macropad: Grid3x3,
    mouse: Mouse,
    gamepad: Gamepad2,
    flightstick: Joystick,
}
