# The device editor

Mice, gamepads and flight sticks open in the **device editor**. It uses the
same layout as the [keymap editor](/guide/editor): a sidebar on the left, the
device in the middle, a toolbar in the header. The device is drawn from its
controls, so a mouse looks like a mouse and a flight stick like a flight stick.

![The Halo M2 demo mouse with its sensor selected: the DPI stages, polling rate and the sensor's own settings in the sheet below the mouse](/images/devices/editor-mouse.webp)

## The sidebar

| Section           | What it holds                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Device**        | The device's name and summary, e.g. _"Mouse · 7 controls"_. A device drawn from a generic layout adds _"· default layout"_. |
| **Switch device** | The other devices you can connect (in a demo, the other demos), one click away. Shown when there is another device.         |
| **Profiles**      | The device's profiles, each with its colour and number (P1, P2…).                                                           |
| **Action types**  | The colour legend: Mouse, Keyboard, Gamepad, Media, Macro, System, Layer / profile.                                         |
| Device card       | At the bottom, as in the keymap editor: connection state and the device menu.                                               |

**Switch device.** The list follows what is plugged in. Picking a device first
asks about unsaved changes (see [the device menu](/guide/app/connecting#the-device-menu)),
then connects the new device before the current one closes: if the new one
fails to connect, you stay where you were.

**Profiles.** Click a profile to edit it. Where the device supports more than
one, **+ Add profile** creates _"Profile N"_ and double-clicking a profile
renames it (Enter keeps the name, Esc cancels). Remappr Firmware devices and
generic devices have a single **Default** profile, so they show neither.

## The stage

The device fills the middle of the window, with the profile you are editing in
a pill at the top left. **Labels / Clean**, at the top right, picks how
bindings are shown:

- **Labels** draws a callout for every control: its name, what it sends, and a
  short detail line (_"Linear · dz 8%"_ for a stick, _"hold · Screenshot"_ for a
  button with a hold action). A leader line joins each callout to its control.
- **Clean** hides the callouts and shows a card for the control under the
  pointer instead.

The hint at the bottom reads _"Click a control to remap it"_, or _"Click a
control to see what it sends"_ on a read-only device.

When a device did not report a layout, a banner explains it: _"**Default
gamepad layout.** This device didn't report a layout (12 buttons · 6 axes · 1
hat). Every input is shown — positions are generic."_ **Fix layout** opens the
device in the [Builder](/guide/builder/device-layout) to re-draw it.

![The Generic USB Gamepad demo: the Default gamepad layout banner with Fix layout, and a generic drawing of 12 buttons, two sticks, two axes and a hat](/images/devices/generic-no-layout.webp)

## Workspaces

Where the inspector opens follows the same setting as the keymap editor,
[Settings → Workspace](/guide/app/settings#workspace):

| Workspace     | Selecting a control…                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| **Workbench** | Opens its inspector in a sheet below the device (the default).                                        |
| **Inspector** | Opens it in a dock on the right. With nothing selected the dock lists every control.                  |
| **Command**   | Opens a card next to the control. A button goes straight to the action palette (**⌘K** / **Ctrl+K**). |

## The inspector

The inspector header shows the control's name and kind, the profile, and
**Reset to default**. Below it are sections made for that control kind. A
device shows only the sections it supports, so a section you see is one you
can use.

![The Vector Pad's left stick in the inspector: Output, Deadzone with Inner and Outer, Response curve and Stick click](/images/devices/inspector-stick.webp)

| Control             | Sections                                                                                                                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Button**          | **Tap**, the action. **Hold**, a second action when held past 200 ms. **Behaviour**: **Turbo** (_"Repeat while held · 12 presses/s"_) and **Toggle** (_"Press once to latch, again to release"_).                                                                                       |
| **Scroll wheel**    | **Directions**: scroll up, scroll down, click, tilt left, tilt right. **Feel**: lines per notch (1–10), smooth scrolling, free-spin.                                                                                                                                                    |
| **Analog stick**    | **Output**: what the stick drives (a stick, the mouse cursor, WASD, arrow keys, scroll…). **Deadzone**: inner and outer, with a live preview. **Response curve**: Linear, Aggressive, Relaxed or Precise, plus **Invert Y axis**. **Stick click**: the action of pressing the stick in. |
| **Analog trigger**  | **Output**. **Travel**: Analog, Hair trigger or Digital, the actuation start and full-press point, trigger rumble.                                                                                                                                                                      |
| **Directional pad** | **Mode**: 4-way or 8-way. **Directions**: one action per direction on a 3×3 grid. Diagonals dim in 4-way mode.                                                                                                                                                                          |
| **Optical sensor**  | **DPI stages**: up to five; click a stage to make it the active one, − / + to change it. **Polling rate**. **Tracking**: lift-off distance, angle snapping, motion sync.                                                                                                                |
| **Rotary encoder**  | **Rotation**: clockwise, counter-clockwise, press. **Feel**: detents per action (1–6).                                                                                                                                                                                                  |
| **Analog axis**     | **Output**. **Response**: curve, centre deadzone (0–30%), invert.                                                                                                                                                                                                                       |

![The D-pad in 4-way mode: four directions bound, the diagonals dimmed](/images/devices/inspector-hat.webp)

## Assigning an action

Click an action field to open **Assign action**: the same picker the keymap
editor uses for a key. Its action list holds what the device can send:

- **Key press**: every keyboard and media key the device can send, in the
  keycode grid with its tabs and search, as on a keyboard.
- The device's other groups (Mouse, Gamepad, System, Macro, Profile / layer,
  and so on), each picked from its list.
- **Disabled** turns the control off.

A device offers only the actions it can send. Choosing a type in the list
binds nothing yet: the action is set when you pick it from that type. The
picker stays open after a pick, so you can try a few; **←** goes back to the
inspector.

![Assign action for the Halo M2's rear side button: the action list and the Key press keycode grid](/images/devices/action-picker.webp)

In the **Command** workspace, **⌘K** (**Ctrl+K**) opens the same list as a
palette, _"Assign action to …"_, with **Disabled** first.

## Live view

**Live view** (⚡ in the toolbar) shows the device as you use it: pressed
buttons glow, sticks lean the way you push them, the d-pad lights its
direction. A **LIVE** pill appears next to the profile while it is on. It is
offered by devices that report their input: Remappr Firmware joysticks,
[generic controllers and mice](/guide/devices/generic-hid), and the demos.

![Live view on the Vector Pad: the LIVE pill, and the left bumper glowing as it is pressed](/images/devices/live-view.webp)

## The toolbar

| Button              | Does                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live view**       | Toggles [live view](#live-view). Hidden when the device has no live input.                                                                                       |
| **Export profiles** | Downloads the device's settings, e.g. a `remappr.device.json` for a Remappr Firmware device.                                                                     |
| **Edit layout**     | _"Edit layout in the Builder"_: re-draw the device. See [Designing a device](/guide/builder/device-layout).                                                      |
| **Device settings** | Settings that are not a control: [mouse](/guide/devices/mice#device-settings) or [joystick](/guide/devices/gamepads#calibration). Remappr Firmware devices only. |
| **Settings**        | [App settings](/guide/app/settings).                                                                                                                             |
| **Undo / Redo**     | Every binding change can be undone.                                                                                                                              |
| **Discard / Save**  | Devices that save to the device: changes are staged until **Save** writes them.                                                                                  |

## Saving

A Remappr Firmware device stages your changes and writes them all at once
with **Save**, the same as a ZMK keyboard; **Discard** drops them. The
[Auto-save setting](/guide/app/settings#communication) applies here too. Demo
devices keep edits for the session only, and generic devices are read-only.

## Shortcuts

| Keys                         | Does                                                |
| ---------------------------- | --------------------------------------------------- |
| **⌘Z** / **Ctrl+Z**          | Undo                                                |
| **⇧⌘Z**, **⌘Y** / **Ctrl+Y** | Redo                                                |
| **⌘K** / **Ctrl+K**          | Assign an action (Command workspace)                |
| **Esc**                      | Close the picker, then the inspector, then deselect |

## Next

- [Mice →](/guide/devices/mice)
- [Gamepads & flight sticks →](/guide/devices/gamepads)
