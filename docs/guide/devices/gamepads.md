# Gamepads & flight sticks

Gamepads and flight sticks are both **joysticks** to Remappr, drawn in different
shapes. Both open in the [device editor](/guide/devices/device-editor). A
Remappr Firmware joystick is fully editable; any other controller can be viewed
and tested live.

![The Apex Flight Stick demo: an 8-way hat, trigger, thumb button and pinky lever on the head, a twist axis and the stick on the shaft, buttons and a throttle wheel on the base](/images/devices/editor-flightstick.webp)

## Remappr Firmware joysticks

A Remappr Firmware joystick connects over USB and shows up in **Available
Devices** like a keyboard. To the computer it is a standard game controller
with 32 buttons, an 8-way hat and six axes (X, Y, Z, Rx, Ry, Rz), so games see
it without a driver. It reports where its controls sit, so Remappr draws it
in its real shape, as a gamepad or as a flight stick.

### Buttons

Each button takes one **Tap** action:

| Group               | Actions                                                              |
| ------------------- | -------------------------------------------------------------------- |
| **Gamepad buttons** | Button 1–32                                                          |
| **Hat**             | Hat up, up-right, right, down-right, down, down-left, left, up-left  |
| **Axes**            | An axis held at full deflection while pressed: X +, X −, Y +, … Rz − |

**Disabled** turns a button off. Left at its default, a d-pad button moves the
hat and any other button presses the gamepad button of its own number.

### Sticks

| Section            | Settings                                                                                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Output**         | The pair of axes the stick drives: **X / Y**, **Rx / Ry**, **Z / Rz**, or **Off**.                                                                                                                                                                                                                                                     |
| **Deadzone**       | **Inner**: how far the stick moves before it counts. **Outer**: how close to the edge counts as full. **Round deadzone** (on by default) measures both from the centre in every direction, so the dead middle is round and full comes at the same push every way; off, each axis has its own (a square), as some flight sticks prefer. |
| **Response curve** | **Linear**; **Aggressive** (quick off the centre); **Relaxed** (gentle near the centre); **Precise** (gentler still, for fine aim). **Invert Y axis** flips up and down.                                                                                                                                                               |
| **Stick click**    | The action of pressing the stick in.                                                                                                                                                                                                                                                                                                   |

![A stick in the inspector: Output, Deadzone, Response curve and Stick click](/images/devices/inspector-stick.webp)

### D-pad

The d-pad (the hat) takes an action for each of up, down, left and right, and a
**Mode**: **4-way** or **8-way**. In 8-way mode two neighbouring directions
together report the diagonal. In 4-way mode the vertical one wins. Opposite
directions cancel out.

### Calibration

Every stick is a little different, so a Remappr Firmware joystick is
calibrated on the stick itself. Open **Device settings** in the toolbar and
**Calibrate**:

1. **Push it round the rim.** Push the stick to its edge and roll it slowly
   all the way round, twice each way. The ring round each stick fills as you
   go; **Next** unlocks when it is full, or after 15 seconds.
2. **Let it go from each corner.** Push the stick into a corner and let it
   snap back. Each corner ticks once the stick has settled. Do all four, let
   go, and **Finish**.

A stick let go from one side stops a little short of its middle on that side,
so the centre is the middle of where it came to rest from all four corners,
not wherever it stopped last. Finish also:

- sizes a **noise filter** from how much the reading jitters at rest (shown as
  _filter N_ on the input's row), so a stick left alone reports a still value;
- **suggests deadzones** for each stick: an inner one that covers where it came
  to rest, and an outer one so that full deflection is reached in every
  direction. **Apply** stages them like any edit, and **Save** writes them.

Then the **Test** opens. Roll the stick slowly round its edge: its output
traces how far it reaches every way, and red marks show directions that fall
short of full. **Zoom on the centre** enlarges the middle tenfold, with the
inner deadzone in red: let the stick go a few times, and its dots should settle
inside it. **Test** opens it again at any time.

Each analog input also has a row with a live bar, its raw reading, its
calibrated minimum, centre and maximum, and its noise filter. **Undo
calibration** goes back to the calibration before (and **Undo** again comes
forward) until the joystick restarts. **Cancel** stops a calibration halfway,
and **Reset to default** forgets the calibration.

The calibration is _"kept on the stick, not in the saved settings"_: saving or
importing settings never resets it.

On Linux, see also [joystick deadzones](/guide/installation#remappr-joystick-deadzones).

### Live view

**Live view** shows the joystick as you use it: buttons glow, the sticks
lean, the hat lights its direction. It reads the stick about twenty times a
second.

### Saving and exporting

Bindings, stick settings and the d-pad mode are staged and written with
**Save**. **Export profiles** downloads them as `remappr.device.json`, the
[device document](/reference/config/device-document).

### Through a dongle

A joystick built for the 2.4 GHz radio pairs with a Remappr dongle like a
mouse. Unplugged from USB, it reports through the dongle, which shows up on
the computer as a gamepad as well as a keyboard and mouse; plugged in, it
reports over USB again. The dongle's gamepad is there even when no joystick
is paired, so games may list an idle controller.

The joystick then shows up under **Mesh nodes** in the dongle's device menu.
Opening it there gives the same editor as over USB, with every change sent
through the dongle: bindings, stick settings and calibration. The live
readout updates four times a second, since each reading is a radio round
trip. **Save** takes a second or two and reads _Saving…_ meanwhile.

## Any other controller

Plug a controller in (USB or Bluetooth) and press any button on it: browsers
only list a controller after it has been used. It then appears under
**Controllers & mice** on the Start Page.

- A controller with the **standard mapping** (most Xbox, PlayStation and
  Nintendo pads) is drawn as a standard gamepad, with its own button names:
  A / B / X / Y, LB / RB and View / Menu on Xbox pads; Cross / Circle / Square
  / Triangle, L1 / R1 and Share / Options on PlayStation pads.
- Any other controller is drawn with a **default layout**: every button, axis
  and hat it reports, in generic positions, with a **NO LAYOUT** badge. **Fix
  layout** re-draws it in the [Builder](/guide/builder/device-layout), and
  Remappr remembers the drawing for that controller model.

These controllers have no protocol Remappr can configure, so they open
read-only. **Live view** works on all of them. See
[Generic controllers & mice](/guide/devices/generic-hid).

## The demo controllers

[Try demo](/guide/devices/overview#try-it-without-hardware) has three: the
**Vector Pad** gamepad (two sticks, analog triggers, a d-pad and back
paddles), the **Apex Flight Stick** (an 8-way hat, a twist axis, a
throttle wheel), and the **Generic USB Gamepad**, a controller without a
layout.

## Next

[Generic controllers & mice →](/guide/devices/generic-hid)
