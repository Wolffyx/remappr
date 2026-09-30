# RGB & lighting

On a connected device, the **RGB lighting** button (💡) in the header opens the
**RGB sheet** — a dock under the board for editing its lighting live. Click the
button again, or the sheet's **×**, to close it.

![The RGB sheet on the Backlight tab: the effect grid under the board](/images/editor/rgb-sheet.webp)

The button is disabled — with the tooltip _"RGB lighting is compile-time only on
this firmware"_ — when the firmware sets its lighting when it is built and
offers no way to change it at runtime. Bind
[lighting actions](/reference/config/actions#lighting) to keys there instead.

Without an RGB-capable device (in demo mode, or a board with no lighting
service), the sheet drives the on-screen **simulation**: the glow around the
caps follows the effect, colour and speed you pick, so you can try effects
before you have the hardware.

## Tabs

| Tab                 | What it does                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Backlight**       | Single-color backlight brightness/effect.                                                      |
| **Per-key RGB**     | Paint per-switch colors directly onto keys.                                                    |
| **Mix RGB**         | _"Split the keyboard into two zones, each with its own looping effect timeline. Coming soon."_ |
| **Underglow**       | Underglow strip control.                                                                       |
| **Indicator Light** | Status indicator LED.                                                                          |
| **Advanced**        | Lower-level RGB controls.                                                                      |

## Effects

The **EFFECT** grid lists the effects the board's firmware offers, in its own
order — each tile with an icon and the effect's name (_Solid Color_,
_Breathing_, _Cycle All_, _Rainbow Beacon_…); the active one is outlined. Below
the grid sit the controls the effect uses:

- **Brightness**.
- **Speed**, for animated effects.
- **Hue** and **Saturation** — only for effects that use the colour you pick.
  Effects that paint their own palette (the _Cycle_ family, _Rainbow Mood_,
  _Rainbow Swirl_, _Typing Heatmap_, _Digital Rain_, ZMK's _Spectrum_ and
  _Swirl_…) hide them, since the picker would change nothing. Effects that shift
  from your colour — _Breathing_, _Band_, _Gradient_, _Beacon_, _Splash_,
  _Starlight_ — keep them.

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
