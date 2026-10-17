# Designing a device

Besides keyboards, the Builder lays out **mice, gamepads and flight sticks**.
You place the controls, and the Builder draws the body around them. Use it to
design a new device, or to re-draw one that Remappr could only show in a
generic layout.

![A new gamepad design in the Builder: the controls on the canvas, the body drawn around them, and the Layout panel with shell parameters and Add control](/images/builder/device-new.webp)

## Starting a design

Open the Builder from the Start Page. Below the keyboard starts, the start
dialog has **Or design a device**: **Mouse**, **Gamepad** or **Flight stick**.
Each starts from a stock layout of that form, named _"My mouse"_, _"My
gamepad"_ or _"My flight stick"_.

The header reads **Builder** with the form and the number of controls, e.g.
_"Gamepad layout · 16 controls"_.

| Button              | Does                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **New design**      | Start over from a stock layout.                                                                                            |
| **Undo / Redo**     | Every change can be undone.                                                                                                |
| **Layout JSON**     | The layout as JSON. See [Layout JSON](#layout-json).                                                                       |
| **Library**         | Designs saved on this machine.                                                                                             |
| **Save to library** | Keep this design: _"Saved "My gamepad" to your library"_.                                                                  |
| **Editor**          | Open the design in the [device editor](/guide/devices/device-editor) as a session-only demo device, to try bindings on it. |

## Placing controls

Controls are placed in key units (1U = 19.05 mm), like keyboard keys.

| Do                   | To                                      |
| -------------------- | --------------------------------------- |
| **Drag** a control   | Move it on the ¼U grid.                 |
| **Alt**-drag (**⌥**) | Place it freely, off the grid.          |
| **Arrow keys**       | Nudge it ¼U. **Shift**+arrow nudges 1U. |
| **Delete**           | Remove it (new designs only).           |
| **Esc**              | Deselect.                               |

### The Layout panel

With nothing selected, the right panel shows the whole device: the number of
controls, the footprint, and the **shell parameters** that shape the body.

| Form             | Shell parameters                        |
| ---------------- | --------------------------------------- |
| **Mouse**        | Edge padding, palm length               |
| **Gamepad**      | Side padding, grip width, grip angle    |
| **Flight stick** | Grip padding, base padding, shaft width |

**Add control** adds one of each kind: Button, Scroll wheel, Analog stick,
Analog trigger, Directional pad, Optical sensor, Rotary encoder, Analog axis.
It lands on the canvas, ready to drag into place.

### The Control panel

Select a control to edit it:

- **Position (U)**: X, Y, width and height, with size presets.
- **Rotation**: the angle, in 5° steps, and **Reset**.
- **Shape**: how the control is drawn (round, pill, stick, d-pad, trigger…).
- **Shell**: which part of the body it sits on (a gamepad's body or top; a
  flight stick's head, shaft or base). The body refits around each zone.
  **On the edge / back** draws it outside the body, for side buttons and
  paddles.
- **Callout**: which side its callout goes in the device editor (**Auto**,
  **Left**, **Right**), and its **Name**.
- **Remove control** (new designs only).

## Re-drawing a device

A device that did not report a layout opens in the device editor with a
generic drawing and a **Fix layout** button. **Edit layout** in the editor's
toolbar does the same for any device that allows it. Both open the Builder
on that device, in fix mode:

![Fix mode for the Vector Pad: the Re-drawing banner, and Apply to device in the header](/images/builder/device-fix.webp)

The banner reads _"Re-drawing **…** — move, resize and rename its controls;
its inputs stay the same."_ You can move, resize, rotate and rename controls,
but not add or remove them: the device has the inputs it has.

- **Apply to device** takes the drawing back to the device editor. A drawing
  that no longer fits the device's inputs is refused: _"This layout does not
  fit the device"_.
- **Default layout** drops your drawing and goes back to the device's own.

Remappr remembers an applied drawing for that device model, so the next time
it connects it is drawn your way.

## Layout JSON

**Layout JSON** (or **View / edit layout JSON** in the Layout panel) opens
_"Device layout"_: the whole layout as JSON, positions in key units, in the
same editor as the keymap's JSON. Mistakes are underlined as you type, and
**Ctrl/⌘+Space** suggests fields and values. Edit it and **Apply layout**, or
**Revert** to the drawing on the canvas. The JSON is checked again before it is
applied.

## Next

- [The device editor →](/guide/devices/device-editor)
- [Mice, controllers & more →](/guide/devices/overview)
