# Lighting

Remappr models three lighting axes, gated per firmware:

| Axis                                  | ZMK | QMK | Keychron |
| ------------------------------------- | :-: | :-: | :------: |
| **Underglow** (addressable RGB strip) | ✅  | ✅  |    ✅    |
| **Backlight** (single-color PWM)      | ✅  | ✅  |    ✅    |
| **Per-key** (per-switch RGB matrix)   |  —  | ✅  |    ✅    |

ZMK has no per-key matrix control; assigning a `per_key` action on a ZMK target
warns and drops to a no-op. (Source: the
[capability matrix](/reference/config/firmware-targets).)

## Two kinds of lighting config

There are two distinct things, and it helps to keep them apart:

1. **Lighting _actions_** — keymap bindings that _change_ lighting at runtime
   (toggle, brightness up/down, hue, effect next, set an absolute color, …).
   These are real, compiled bindings you assign to keys like any other action —
   see the [`lighting` action](/reference/config/actions#lighting).
2. **Board-level lighting _config_** — metadata on the keyboard (default effect,
   hue, brightness) under `keyboard.lighting`. This is additive/export-only for
   now: it records the board's lighting setup rather than emitting a binding.

## In the builder

![The Lighting section with RGB underglow on: Effect chips, colour swatches and a Brightness slider](/images/builder/lighting.webp){width=300}

Turning **RGB underglow** on also opens the
[Hardware pins](/guide/builder/identity-and-hardware#hardware-pins-zmk) section
for its WS2812 data pin. While the builder is open, the board on the canvas glows
with the effect and colour you pick, so you can preview it.

The Identity panel's **Lighting** section declares the board's lighting and
defaults for supported targets (_"Configured for every firmware target — the
exporter maps it to each platform."_):

- **RGB underglow** → **Effect** (**Solid**, **Breathe**, **Rainbow**,
  **Swirl**, **Gradient**), **Color** (the first swatch is Rainbow, the rest set a
  hue), **Brightness** (a percentage).
- **Per-key backlight** → **Backlight brightness**, **Breathing**.

These write `keyboard.lighting`:

```json
"lighting": {
  "underglow": { "effect": "breathe", "hue": 200, "brightness": 80 },
  "backlight": { "brightness": 70, "breathing": true }
}
```

To bind a _control_ (e.g. "this key cycles the effect"), assign a
[`lighting` action](/reference/config/actions#lighting) to the key in the
[binding picker](/guide/builder/layers-and-bindings#the-binding-picker).

## In the editor — per-key RGB

For boards that expose a per-key RGB matrix (Keychron and per-key QMK), the live
[keymap editor](/guide/editor) shows a **per-key paint** surface: select a color
and paint LEDs directly onto the keys, written to the device's LED map. This
lives in the editor phase against a real (or simulated) device, not on the
builder canvas.

## Hardware

Driving real LEDs from a ZMK export needs the hardware described:
**WS2812** underglow on an SPI peripheral, or a **backlight PWM** pin. Set these
in the hardware config; if a lighting feature is enabled but its pin is unset,
the export flags it in the
[readiness checklist](/guide/builder/export-build-flash#readiness). See the
[Hardware reference](/reference/config/hardware#lighting-hardware).

## Next

[Export, build & flash →](/guide/builder/export-build-flash)
