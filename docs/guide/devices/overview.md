# Mice, controllers & more

Remappr is not only for keyboards. Mice, gamepads, flight sticks and macro pads
open in a **device editor** built for their shape: the device is drawn from its
controls, every control has a callout naming what it sends, and selecting one
opens an inspector made for that kind of control: DPI stages for a sensor,
deadzones and a response curve for a stick, 4- or 8-way for a hat.

![The device editor on the Vector Pad demo gamepad: the device card and profiles in the sidebar, the gamepad drawn with a callout per control](/images/devices/editor-gamepad.webp)

## Device types

A device has a **kind** (what its firmware says it is) and a **form** (the
shape it is drawn in). A gamepad and a flight stick are the same kind, a
joystick, drawn differently.

| Form             | Kind     | Opens in                                      | Examples                                                 |
| ---------------- | -------- | --------------------------------------------- | -------------------------------------------------------- |
| **Keyboard**     | keyboard | [Keymap editor](/guide/editor)                | Any ZMK, QMK, VIA, Vial or Keychron board                |
| **Macro pad**    | keyboard | [Keymap editor](/guide/editor)                | A 3×3 pad with encoders (edited like keys)               |
| **Mouse**        | mouse    | [Device editor](/guide/devices/device-editor) | Remappr Firmware mice, any HID mouse                     |
| **Gamepad**      | joystick | [Device editor](/guide/devices/device-editor) | Remappr Firmware joysticks, any USB/Bluetooth controller |
| **Flight stick** | joystick | [Device editor](/guide/devices/device-editor) | Remappr Firmware joysticks drawn as a stick              |

Controls come in eight kinds, each with its own inspector:

| Control             | On                      | You set                                                     |
| ------------------- | ----------------------- | ----------------------------------------------------------- |
| **Button**          | everything              | A tap action, a hold action, turbo, toggle                  |
| **Scroll wheel**    | mice                    | Up, down, click, tilts; lines per notch, smooth, free-spin  |
| **Analog stick**    | gamepads, flight sticks | Output, inner/outer deadzone, response curve, click         |
| **Analog trigger**  | gamepads                | Output, travel (analog / hair trigger / digital), actuation |
| **Directional pad** | gamepads, flight sticks | Each direction, 4-way or 8-way                              |
| **Optical sensor**  | mice                    | DPI stages, polling rate, lift-off, angle snapping          |
| **Rotary encoder**  | a device with a knob    | Clockwise, counter-clockwise, press; detents per action     |
| **Analog axis**     | flight sticks           | Output, curve, centre deadzone, invert                      |

Which of these a device actually offers depends on its firmware: see
[What each device can do](#what-each-device-can-do).

## Where devices show up

**Firmware devices** (a Remappr Firmware mouse or joystick) connect like a
keyboard: they appear in **Available devices** on the Start Page, and **Connect**
opens the device editor. See [Connecting a device](/guide/app/connecting).

**Any other controller or mouse** appears in the **Controllers & mice** section
of the Start Page, headed _"View and live test · no vendor protocol"_. Each
device is a tile with a small drawing of it, its form and a badge:

- **READY**: the device's layout is known, so it is drawn in its real shape.
- **NO LAYOUT**: the device did not report one, so Remappr draws a generic
  layout of its inputs. You can [re-draw it in the Builder](/guide/builder/device-layout).

Browsers only list a game controller after it has been used on the page, so the
section also says _"Controller not listed? Press any button on it."_ Mice are
listed by the desktop app only, which can read the system's HID device list.
Click a tile to open its editor. See
[Generic controllers & mice](/guide/devices/generic-hid).

## What each device can do

| Device                                                                          | Edit bindings |  Save to device  | Live view |      Profiles       |
| ------------------------------------------------------------------------------- | :-----------: | :--------------: | :-------: | :-----------------: |
| [Remappr Firmware mouse](/guide/devices/mice#remappr-firmware-mice)             |      ✅       |        ✅        |     —     |         One         |
| [Remappr Firmware joystick](/guide/devices/gamepads#remappr-firmware-joysticks) |      ✅       |        ✅        |    ✅     |         One         |
| [Any controller or mouse](/guide/devices/generic-hid)                           | — (read-only) |        —         |    ✅     |         One         |
| Demo devices                                                                    |      ✅       | — (session only) |    ✅     | Three, add & rename |

A device that only takes part of the inspector shows only that part: a Remappr
Firmware mouse button has a tap action but no hold or turbo, so those sections
are not drawn. Nothing is greyed out "for later". If a section is shown, the
device supports it.

::: info Remappr Firmware
Remappr Firmware is Remappr's own firmware, in active development. Its mice and
joysticks are fully editable in the device editor today; see the
[roadmap](/guide/roadmap#remappr-firmware) for where it stands.
:::

## Try it without hardware

**Try demo** on the Start Page opens _"Try a demo device"_: six simulated
devices, _"nothing is written anywhere"_.

![The demo chooser: Corne, Deck 9, Halo M2, Vector Pad, Apex Flight Stick and Generic USB Gamepad](/images/devices/demo-chooser.webp)

| Demo                    | Form         | Shows                                                         |
| ----------------------- | ------------ | ------------------------------------------------------------- |
| **Corne**               | Keyboard     | The [keymap editor](/guide/editor)                            |
| **Deck 9**              | Macro pad    | Nine keys and two encoders in the keymap editor               |
| **Halo M2**             | Mouse        | Buttons with hold actions, a scroll wheel, five DPI stages    |
| **Vector Pad**          | Gamepad      | Two sticks, analog triggers, a d-pad, back paddles            |
| **Apex Flight Stick**   | Flight stick | An 8-way hat, a twist axis, a throttle wheel                  |
| **Generic USB Gamepad** | Gamepad      | A controller with **NO LAYOUT**: read-only, generic positions |

The demos offer the whole inspector, so they are the place to see every
control kind. Edits last for the session. In the editor, **Switch device** in
the sidebar moves between demos.

## Next

- [The device editor →](/guide/devices/device-editor)
- [Mice →](/guide/devices/mice)
- [Gamepads & flight sticks →](/guide/devices/gamepads)
- [Generic controllers & mice →](/guide/devices/generic-hid)
- [Designing a device in the Builder →](/guide/builder/device-layout)
