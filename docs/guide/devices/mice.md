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

### Sensor settings

Below the DPI stages, the **Sensor** section shows the settings this mouse's
sensor has, and only those: the sensor tells Remappr what it can do, so two
mice with different sensors show different lists. With a PixArt PAW3395 they
are:

| Setting               | Choices                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Lift-off distance** | **1 mm**, **2 mm**, or **Calibrated** (the height a [lift-off calibration](#sensor-procedures-and-readings) measured on your surface). |
| **Angle snapping**    | Straightens nearly straight lines.                                                                                                     |
| **Angle tune**        | Rotates the motion, −30° to 30°, to match how you hold the mouse.                                                                      |
| **Performance mode**  | High performance, Low power, Office or Corded gaming.                                                                                  |
| **Stay awake**        | Keeps the sensor out of its rest modes: fastest wake, more power.                                                                      |
| **Advanced**          | The rest-mode timings, folded away: how soon the sensor drops to each rest mode and how often it reads there.                          |

A change takes effect on the mouse at once, so you can feel it before you keep
it; **Save** keeps it and **Discard** puts the old value back. A timing the
sensor's registers cannot hold exactly is rounded, and the editor shows the
value the sensor took. Hover a setting you changed for its reset arrow, which
puts it back to the mouse's default. A mouse built from a
[JSON config](/reference/config/overview) can carry its own defaults, so
"default" is the product's choice, not always the sensor's.

**Calibrated** needs a lift-off calibration first. Until the mouse holds one,
the option is greyed out with a note that says so; it opens the moment a
calibration in Device settings finishes, and closes again if you forget the
result. (A mouse whose firmware does not report a stored result leaves it
open and refuses it when picked.)

### Device settings

**Device settings** in the toolbar holds the settings that are not a control.

| Section                | Settings                                                                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live**               | _"Applies at once and stays until you save settings, which replace it."_ A DPI slider with **Apply** (the sensor's range and step are shown), acceleration **Flat** or **Curve**, wheel **Normal** or **Inverted**. Good for trying a setting before keeping it.                   |
| **Pointer**            | DPI (empty = the sensor's own resolution; with DPI stages it edits the starting stage), **Invert X**, **Invert Y**, **Invert wheel**, **Invert horizontal wheel**, **Swap X and Y** (applied before the inverts), **Scroll divisor** 1–16 (wheel counts per reported scroll step). |
| **Acceleration curve** | Up to 8 points. Above each input speed, motion is scaled by the point's percentage (100% = unchanged). No points = flat.                                                                                                                                                           |
| **2.4 GHz link**       | How the mouse talks to its dongle: **Pair on its own**, keepalive (20–1000 ms), beacon loss (200–10000 ms), input repeats (1–8).                                                                                                                                                   |
| **Sensor**             | Live readings and the sensor's procedures; see below.                                                                                                                                                                                                                              |

Changes here are staged with the rest of the mouse: **Save** in the header
writes them all.

### Sensor procedures and readings

The **Sensor** section of Device settings shows what the sensor reads right
now, as meters: **Surface quality** (how well it sees the surface under it;
higher is better, so slide the mouse over a few pads to compare them) and
**Lifted**. The readings pause while a procedure needs the sensor.

It also runs the sensor's procedures. A PAW3395 has a **Lift-off
calibration**, which measures your surface so the lift-off height fits it:

1. **Start**, then move the mouse slowly over the whole area you use and press
   **Next**.
2. Keep moving the mouse while it measures; a bar shows how far it has got,
   and it finishes by itself.

**Done** means the mouse kept the result. Then choose **Calibrated** under
Lift-off distance on the sensor. The result belongs to the mouse, not to its
settings: no **Save** is needed, saving other settings never replaces it, and
it is not part of an export. It also survives a restart: when the mouse
already holds one, the section says _"A result is stored on this device"_
and the button reads **Run again**. Calibrate again after changing pads.
**Forget the result**, shown only while a result is stored, removes it, and
a lift-off distance set to Calibrated goes back to its default. **Cancel**
during a run keeps the result the mouse already had. If you press Next
without having moved the mouse, the calibration ends with **Did not
finish**; run it again.

### Saving and exporting

**Save** writes the mouse's settings in one go and **Discard** drops them. See
[Saving](/guide/devices/device-editor#saving). **Export profiles** downloads them
as `remappr.device.json`, the
[device document](/reference/config/device-document).

### Through a dongle

A mouse paired to a Remappr dongle shows up under **Mesh nodes** in the
dongle's device menu. Opening it there gives a read-only view: its bindings,
DPI stages and settings read through the dongle, and the sensor's readings
live. To change them or run a calibration, connect the mouse over USB. Device
settings says so: _"Read-only through the dongle. Connect the mouse over USB
to change its settings."_

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
tilt and feel settings, five DPI stages, polling rates up to 8 kHz, and sensor
settings (lift-off distance, angle snapping, motion sync, angle tune,
performance mode, an advanced rest timing). Its Device settings show live
sensor readings and a lift-off calibration you can run through.

## Next

[Gamepads & flight sticks →](/guide/devices/gamepads)
