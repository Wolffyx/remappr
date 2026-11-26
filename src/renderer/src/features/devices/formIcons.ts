// pattern-check: skip — pure data: lucide icon per device form and per device kind.
import {
    Gamepad2,
    Grid3x3,
    Joystick,
    Keyboard,
    Mouse,
    Radio,
    type LucideIcon,
} from 'lucide-react'
import type { DeviceForm, DeviceKind } from '@firmware/devices/types'

export const FORM_ICON: Readonly<Record<DeviceForm, LucideIcon>> = {
    keyboard: Keyboard,
    macropad: Grid3x3,
    mouse: Mouse,
    gamepad: Gamepad2,
    flightstick: Joystick,
}

/** For a device known only by kind, such as a node in a dongle's roster. A
 *  joystick's form is unknown until it is opened; most are gamepads. */
export const KIND_ICON: Readonly<Record<DeviceKind, LucideIcon>> = {
    keyboard: Keyboard,
    mouse: Mouse,
    joystick: Gamepad2,
    dongle: Radio,
}
