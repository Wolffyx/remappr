# Mice

A mouse opens in the [device editor](/guide/devices/device-editor), drawn from
its buttons, wheel and sensor. What you can change depends on its firmware: a
Remappr Firmware mouse is fully editable, and any other mouse can be viewed and
tested.

## Remappr Firmware mice

A Remappr Firmware mouse connects over USB like a keyboard. Pick it in
**Available Devices** on the Start Page, and the device editor opens on it. It
draws itself: the firmware reports where each button, the wheel and the sensor
sit.

### Buttons

Each button takes one **Tap** action, chosen from two groups:

| Group             | Actions                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mouse buttons** | Left click, Right click, Middle click, Back, Forward, Button 6–8                                                                                      |
| **DPI**           | **DPI cycle** (next stage, wrapping round), **DPI up**, **DPI down**, and **Sniper 200 / 400 / 800 DPI (hold)**, offered where the sensor can do them |

**Disabled** turns a button off. A sniper button holds the sensor at its DPI
while pressed and goes back when released. A DPI set to a fixed value in an
imported settings file shows as _"DPI 1600"_ and the like.

The **scroll wheel** takes a **Click** action the same way. A Remappr Firmware
mouse has no hold actions, turbo or toggle, so those sections are not shown.

### DPI stages and polling rate

Select the **sensor** to edit its DPI stages, up to five. The highlighted stage
is the one the mouse starts at. A **DPI cycle**, **DPI up** or **DPI down**
button steps through the stages on the mouse itself.

**Polling rate** offers the rates this mouse can report at over its current
link (125 Hz to 8 kHz, as the firmware allows). The rate belongs to the mouse,
not to its settings: it is applied on **Save** and is not part of an export.

### Device settings

**Device settings** in the toolbar holds the settings that are not a control.

| Section                | Settings                                                                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live**               | _"Applies at once and stays until you save settings, which replace it."_ A DPI slider with **Apply** (the sensor's range and step are shown), acceleration **Flat** or **Curve**, wheel **Normal** or **Inverted**. Good for trying a setting before keeping it.                   |
| **Pointer**            | DPI (empty = the sensor's own resolution; with DPI stages it edits the starting stage), **Invert X**, **Invert Y**, **Invert wheel**, **Invert horizontal wheel**, **Swap X and Y** (applied before the inverts), **Scroll divisor** 1–16 (wheel counts per reported scroll step). |
| **Acceleration curve** | Up to 8 points. Above each input speed, motion is scaled by the point's percentage (100% = unchanged). No points = flat.                                                                                                                                                           |
| **2.4 GHz link**       | How the mouse talks to its dongle: **Pair on its own**, keepalive (20–1000 ms), beacon loss (200–10000 ms), input repeats (1–8).                                                                                                                                                   |

Changes here are staged with the rest of the mouse: **Save** in the header
writes them all.

### Saving and exporting

**Save** writes the mouse's settings in one go and **Discard** drops them. See
[Saving](/guide/devices/device-editor#saving). **Export profiles** downloads them
as `remappr.device.json`, the
[device document](/reference/config/device-document).

### Through a dongle

A mouse paired to a Remappr dongle shows up under **Mesh nodes** in the
dongle's device menu. Opening it there gives a read-only view: its bindings,
DPI stages and settings read through the dongle. To change them, connect the
mouse over USB. Device settings says so: _"Read-only through the dongle.
Connect the mouse over USB to change its settings."_

## Any other mouse

The desktop app lists the mice it finds in the system's HID device list under
**Controllers & mice** on the Start Page, as _"HID mouse · VVVV:PPPP"_ (its
USB vendor and product id). It has no protocol Remappr can configure, so it
opens read-only, drawn as a generic five-button mouse with a wheel.

**Live view** works: click, scroll and move, and the drawing follows. While live
view is on, the right-click menu, middle-click autoscroll and back / forward
navigation are held back so you can test those buttons. Live view reads the
system pointer, so any mouse moves it, not only the one you opened.

If the drawing does not match the mouse, **Fix layout** re-draws it in the
[Builder](/guide/builder/device-layout). Remappr remembers the new layout for
that mouse model.

## The demo mouse

**Halo M2**, in [Try Demo](/guide/devices/overview#try-it-without-hardware),
shows the whole mouse inspector: buttons with hold actions, a scroll wheel with
tilt and feel settings, five DPI stages, polling rates up to 8 kHz, and
tracking settings (lift-off distance, angle snapping, motion sync).

## Next

[Gamepads & flight sticks →](/guide/devices/gamepads)
