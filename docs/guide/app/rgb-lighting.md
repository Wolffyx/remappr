# RGB & lighting

On a connected device, **Lighting** (💡) in the toolbar opens the **Lighting
sheet** — a dock under the board for editing its lighting live. Click the tool
again, or the sheet's **×**, to close it.

![The Lighting sheet on the Backlight tab: 1 the effect list, 2 the colour wheel, 3 brightness and speed](/images/editor/rgb-sheet.webp)

The button is disabled — with the tooltip _"RGB lighting is compile-time only on
this firmware"_ — when the firmware sets its lighting when it is built and
offers no way to change it at runtime. Bind
[lighting actions](/reference/config/actions#lighting) to keys there instead.

Without an RGB-capable device (in demo mode, or a board with no lighting
service), the sheet drives the on-screen **simulation**: the glow around the
caps follows the effect, colour and speed you pick, so you can try effects
before you have the hardware.

## Tabs

| Tab                  | What it does                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Backlight**        | Single-color backlight brightness/effect.                                                      |
| **Per-key RGB**      | Paint per-switch colors directly onto keys.                                                    |
| **Mix RGB**          | _"Split the keyboard into two zones, each with its own looping effect timeline. Coming soon."_ |
| **Underglow**        | Underglow strip control.                                                                       |
| **Indicator lights** | Status indicator LED.                                                                          |
| **Advanced**         | Lower-level RGB controls.                                                                      |

## Effects

The **Backlight** tab works in three numbered steps:

1. **Effect** — the effects the board's firmware offers, grouped (_Basic_,
   _Gradient_, _Band_, _Rainbow cycle_, _Reactive_, _Rain & pixels_) with a
   moving preview each and plain names (_Solid colour_, _Cycle up–down_, _Band
   saturation_…). Search matches the plain name or the firmware's own; hover a
   row to see the firmware's name.
2. **Colour** — a colour wheel: round the wheel picks the colour, towards the
   middle makes it paler. Beside it: the colour's name, its hex value (type one
   in) and twelve presets. Effects that paint their own palette (the _Cycle_
   family, _Rainbow Mood_, _Typing Heatmap_, _Digital Rain_, ZMK's _Spectrum_
   and _Swirl_…) grey this step out and say why, since the colour would change
   nothing.
3. **Brightness & speed** — a preview strip, **Brightness**, and **Speed** for
   animated effects (a note replaces it when the effect does not move).

Changes are sent to the device as you move the controls.

## Per-key painting

In **Per-key RGB**, click keys on the board to select them (multi-select for
batch coloring), pick a color, and it writes to the device's LED map. While
painting, the binding picker is suppressed so clicks select LEDs, not bindings.

## Saving

The sheet's **Save** button commits RGB settings to the keyboard (_"RGB settings
saved to keyboard"_). It only appears on a real device with an RGB service — in
the simulator there is nothing to persist to.

## See also

- [Builder lighting](/guide/builder/lighting) — declaring lighting on a design
- [`lighting` action](/reference/config/actions#lighting) — keymap-bound controls
  (the ZMK path)
