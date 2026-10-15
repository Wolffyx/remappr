# Generic controllers & mice

Most controllers and mice have no protocol for changing their settings, or a
protocol only their maker's software speaks. Remappr can still show them: what
each input is, and what it does as you use it. The Start Page lists them under
**Controllers & mice**, with the note _"View and live test · no vendor
protocol"_.

## What is listed

| Device                              | Found by                     | Where                   |
| ----------------------------------- | ---------------------------- | ----------------------- |
| Game controllers (USB or Bluetooth) | The browser's Gamepad API    | Browser and desktop app |
| Mice                                | The system's HID device list | Desktop app only        |

A browser only reveals a controller after it has been used on the page, so the
section says _"Controller not listed? Press any button on it."_ A device that
already connected as a firmware device, such as a Remappr Firmware mouse, is
not listed again here.

Each device is a tile with a drawing of it, its form and a badge:

- **READY**: drawn in its real shape. Controllers with the standard mapping are
  drawn as a standard gamepad with their own button names (Xbox, PlayStation,
  Nintendo).
- **NO LAYOUT**: the device did not report its shape, so Remappr draws every
  input it has in generic positions. The tile reads what it found, e.g. _"12
  buttons · 6 axes · 1 hat"_ or _"HID mouse · 046D:C08B"_.

Click a tile to open it in the [device editor](/guide/devices/device-editor).

## Read-only

A generic device opens read-only: one **Default** profile, nothing to save.
Click a control to see what it sends. The hint at the bottom reads _"Click a
control to see what it sends"_, and the inspector marks the profile _"·
read-only"_.

## Live test

**Live view** (⚡) is where a generic device is useful: press, push and scroll,
and the drawing follows. Use it to check that every button registers, a stick
centres, or a trigger reaches full travel.

- **Controllers** are read through the Gamepad API.
- **Mice** are read through the system pointer, so any mouse moves the drawing.
  While live view is on, the right-click menu, middle-click autoscroll and back
  / forward navigation are held back, so those buttons can be tested without
  leaving the page.

## Fixing the drawing

A device with **NO LAYOUT** opens with the banner _"Default … layout. This
device didn't report a layout … Every input is shown — positions are
generic."_ **Fix layout** opens it in the [Builder](/guide/builder/device-layout),
where you move, resize and rename its controls to match the real thing. Its
inputs stay the same. **Apply to device** brings the new drawing back, and
Remappr remembers it for that device model.

## Unplugging

Unplugging a device closes its editor with _"… was unplugged"_.

## Next

[Designing a device in the Builder →](/guide/builder/device-layout)
