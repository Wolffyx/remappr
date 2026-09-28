# Keymap format

This page walks the keymap config top to bottom. Field names and meanings are
taken directly from the config type definitions. Required fields are marked **·
required**; everything else is optional.

A complete, real example is the demo Corne shipped with Remappr (a 36-key split
with home-row mods and lower/raise layers). Excerpts below are drawn from it.

## Top level

```jsonc
{
  "schemaVersion": 1,          // · required — fixed at 1
  "kind": "remappr.keymap",    // · required — document discriminator
  "meta": { … },               // · required
  "defaults": { … },           // optional global timings
  "keyboard": { … },           // · required — geometry + hardware
  "layers": [ … ],             // · required — at least one layer
  "combos": [ … ],             // optional
  "tapDances": [ … ],          // optional
  "macros": [ … ],             // optional
  "modMorphs": [ … ],          // optional
  "holdTaps": [ … ],           // optional custom hold-tap definitions
  "conditionalLayers": [ … ]   // optional
}
```

## `meta`

Identity of the keymap.

| Field         | Type                                                    | Notes                                                                 |
| ------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `name`        | string · required                                       | Display name.                                                         |
| `target`      | `"zmk"` \| `"qmk"` \| `"keychron"` \| `null` · required | Pinned single target, or `null` (builder uses `keyboard.firmware[]`). |
| `author`      | string                                                  |                                                                       |
| `version`     | string                                                  |                                                                       |
| `description` | string                                                  |                                                                       |
| `vendorId`    | string                                                  | USB vendor id, hex e.g. `"0xFEED"`.                                   |
| `productId`   | string                                                  | USB product id, hex e.g. `"0x0001"`.                                  |

```json
"meta": {
  "name": "Mock Corne",
  "author": "remappr",
  "version": "1.0.0",
  "target": null
}
```

## `defaults`

Global behavior timings, in milliseconds. Per-action overrides win over these;
an absent field keeps the firmware's own default. The builder's
[Timing & defaults](/guide/builder/identity-and-hardware#timing-defaults) section
and the editor's [Timing & Defaults](/guide/app/advanced#timing-defaults) dialog
edit them.

| Field                     | Type   | Meaning                                             |
| ------------------------- | ------ | --------------------------------------------------- |
| `tappingTermMs`           | number | Hold-vs-tap decision window.                        |
| `quickTapMs`              | number | Tap-then-hold within this window repeats the tap.   |
| `comboTimeoutMs`          | number | Max time between the keys of a combo.               |
| `releaseDebounceMs`       | number | Key-release debounce; 0 keeps the firmware value.   |
| `pressDebounceMs`         | number | Key-press debounce; 0 keeps the firmware value.     |
| `matrixPressDebounceMs`   | number | Matrix-scan press debounce.                         |
| `matrixReleaseDebounceMs` | number | Matrix-scan release debounce.                       |
| `capsWordIdleMs`          | number | Leave caps-word after this idle time; 0 = never.    |
| `stickyReleaseDefaultMs`  | number | Sticky-key lifetime; 0 = until the next key.        |
| `macroDefaultWaitMs`      | number | Default gap between macro steps.                    |
| `macroDefaultTapMs`       | number | Default tap hold-time inside a macro.               |
| `matrixPollPeriodMs`      | number | Matrix scan interval; 0 keeps the devicetree value. |

The last five apply on Remappr Firmware.

## `keyboard`

The physical board: geometry, matrix, controller, hardware and lighting. Most
sub-objects are documented in [Hardware](/reference/config/hardware); the layout
fields are here.

| Field            | Type                                 | Notes                                                                                            |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `id`             | string · required                    | Stable slug; seeds export project/shield names.                                                  |
| `name`           | string · required                    | Display name.                                                                                    |
| `keys`           | `CanonGeometry[]` · required         | One entry per physical key (see below).                                                          |
| `encoders`       | `{ x, y }[]`                         | Standalone encoder slots (parallel-array style).                                                 |
| `matrix`         | object                               | Board-level `rows`/`cols`/diode/mode — see [Hardware](/reference/config/hardware#matrix).        |
| `controller`     | object                               | MCU identity — see [Hardware](/reference/config/hardware#controller).                            |
| `vial`           | object                               | Vial UID + unlock — see [Hardware](/reference/config/hardware#vial).                             |
| `hardware`       | object                               | kscan / transform / LED / power nodes — see [Hardware](/reference/config/hardware).              |
| `pins`           | `{ rows: string[], cols: string[] }` | Friendly per-row/col GPIO labels (builder metadata).                                             |
| `firmware`       | string[]                             | Builder multi-select targets: `"qmk"` `"via"` `"vial"` `"zmk"`.                                  |
| `lighting`       | object                               | Board-level lighting — see [Hardware](/reference/config/hardware#lighting-hardware).             |
| `firmwareConfig` | object                               | Modeled `.conf`/`config.h` toggles — see [Hardware](/reference/config/hardware#firmware-config). |
| `layouts`        | `{ id, name }[]`                     | Physical-layout variants; keys tag in via `variant`.                                             |
| `layoutOptions`  | `{ label, choices? }[]`              | VIA/Vial layout options; keys tag in via `option`.                                               |
| `split`          | boolean                              | Two-piece keyboard flag.                                                                         |

### `keyboard.keys[]` — key geometry

Each key is a `CanonGeometry`:

| Field      | Type                      | Notes                                                                        |
| ---------- | ------------------------- | ---------------------------------------------------------------------------- |
| `x`, `y`   | number · required         | Position in key units (U).                                                   |
| `w`, `h`   | number                    | Width / height in U. Default 1.                                              |
| `r`        | number                    | Rotation, degrees. Default 0.                                                |
| `rx`, `ry` | number                    | Rotation origin.                                                             |
| `matrix`   | `[row, col]`              | Electrical position. Authoritative when present; else derived from geometry. |
| `pin`      | string                    | Per-key direct GPIO label (direct-pin boards).                               |
| `element`  | `"encoder"` \| `"slider"` | Non-switch input element; absent = a normal key.                             |
| `variant`  | string                    | Physical-layout variant id this key belongs to.                              |
| `option`   | `[group, choice]`         | VIA/Vial layout-option this key is gated by.                                 |

```json
"keys": [
  { "x": 0, "y": 0 },
  { "x": 1, "y": 0 },
  { "x": 2, "y": 0 }
]
```

::: tip Minimized configs
Defaulted fields (`w`/`h`/`r` = 1/1/0) are dropped when Remappr serializes, so a
saved config is compact — `{ "x": 0, "y": 0 }` is a full 1U key. See
[Normalization & round-trip](/reference/config/normalization) for the full
default-stripping rules; the [JSON Schema](/reference/config/json-schema) treats
defaulted fields as optional so minimized files validate clean.
:::

## `layers`

An ordered array; index 0 is the base layer. A `transparent` binding falls
through to the layer **below**, so order matters.

| Field             | Type                                  | Notes                                                                      |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `name`            | string · required                     | Referenced by name (e.g. layer-tap targets).                               |
| `bindings`        | `Action[]` · required                 | One [action](/reference/config/actions) per key, in `keyboard.keys` order. |
| `description`     | string                                |                                                                            |
| `encoders`        | `{ cw, ccw, press? }[]`               | Slot-indexed encoder bindings (aligned to `keyboard.encoders`).            |
| `encoderBindings` | `{ [keyIndex]: { cw, ccw, press? } }` | Per-key encoder bindings (key has `element: "encoder"`).                   |
| `sliderBindings`  | `{ [keyIndex]: SliderBinding }`       | Per-key slider value-mappings (key has `element: "slider"`).               |

```json
{
    "name": "base",
    "bindings": [
        "Q",
        "W",
        "E",
        "R",
        "T",
        { "type": "mod_tap", "tap": "A", "mod": "LEFT_GUI" },
        {
            "type": "layer_tap",
            "tap": "SPACE",
            "layer": "raise",
            "resolve": "prefer-hold"
        }
    ],
    "encoders": [{ "cw": "Volume Up", "ccw": "Volume Down" }]
}
```

See [Actions](/reference/config/actions) for the full binding catalog and the
friendly shorthand (bare keys, `"Ctrl+C"`, presets).

## `combos`

A chord: pressing several key **positions** together fires one action.

| Field       | Type                | Notes                                             |
| ----------- | ------------------- | ------------------------------------------------- |
| `name`      | string · required   |                                                   |
| `keys`      | number[] · required | Key **positions** (indices into `keyboard.keys`). |
| `action`    | Action · required   | What the chord fires.                             |
| `timeoutMs` | number              |                                                   |
| `layers`    | string[]            | Restrict to these layers.                         |

```json
{
    "name": "esc",
    "keys": [0, 1],
    "action": "ESCAPE",
    "timeoutMs": 50,
    "layers": ["base"]
}
```

## `tapDances`

Multi-tap behaviors referenced by `id` from a `tap_dance` action.

| Field           | Type                             | Notes                                     |
| --------------- | -------------------------------- | ----------------------------------------- |
| `id`            | string · required                |                                           |
| `taps`          | `{ count, action }[]` · required | Action per tap count.                     |
| `hold`          | hold target                      | Optional hold action (modifier or layer). |
| `tappingTermMs` | number                           |                                           |
| `description`   | string                           |                                           |

```json
{
    "id": "esc_grave",
    "taps": [
        { "count": 1, "action": "ESCAPE" },
        { "count": 2, "action": "GRAVE" }
    ],
    "hold": { "type": "modifier", "modifier": "LEFT_GUI" }
}
```

## `macros`

Sequences of steps referenced by `id` from a `macro` action.

| Field         | Type                     | Notes                                         |
| ------------- | ------------------------ | --------------------------------------------- |
| `id`          | string · required        |                                               |
| `steps`       | `MacroStep[]` · required | See step types below.                         |
| `params`      | `0` \| `1` \| `2`        | Binding-cells: plain / one-param / two-param. |
| `description` | string                   |                                               |

**Macro step types:**

| Step                        | Fields         | Meaning                                      |
| --------------------------- | -------------- | -------------------------------------------- |
| `tap` / `press` / `release` | `key`          | Tap, hold, or release a key.                 |
| `wait`                      | `ms`           | Delay.                                       |
| `text`                      | `text`         | Type a literal string.                       |
| `param`                     | `from?`, `to?` | Forward a macro argument (defaults 1→1).     |
| `tap_time`                  | `ms`           | Override how long tapped behaviors are held. |
| `pause_for_release`         | —              | Block until the trigger key is released.     |

```json
{
    "id": "lock_screen",
    "steps": [
        { "type": "press", "key": "LEFT_GUI" },
        { "type": "tap", "key": "L" },
        { "type": "release", "key": "LEFT_GUI" }
    ]
}
```

## `modMorphs`

A behavior that sends one binding normally and a different one while a modifier
is held. Referenced by `id` from a `mod_morph` action.

| Field         | Type                          | Notes                             |
| ------------- | ----------------------------- | --------------------------------- |
| `id`          | string · required             |                                   |
| `mods`        | Modifier[] · required         | Modifiers that trigger the morph. |
| `bindings`    | `[Action, Action]` · required | `[normal, while-held]`.           |
| `keepMods`    | Modifier[]                    | Modifiers passed through.         |
| `description` | string                        |                                   |

## `holdTaps`

Custom hold-tap **definitions** (the ZMK `behavior-hold-tap`), referenced by `id`
from a `hold_tap` action that supplies the two inner params.

| Field                                               | Type                          | Notes                                                                          |
| --------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `id`                                                | string · required             |                                                                                |
| `bindings`                                          | `[string, string]` · required | The two inner behavior tokens (e.g. `"&kp"`, `"&mo"`).                         |
| `flavor`                                            | hold-tap flavor               | `hold-preferred` \| `balanced` \| `tap-preferred` \| `tap-unless-interrupted`. |
| `tappingTermMs`, `quickTapMs`, `requirePriorIdleMs` | number                        | Timings.                                                                       |
| `holdTriggerKeyPositions`                           | number[]                      | Positional hold-trigger.                                                       |
| `holdTriggerOnRelease`, `retroTap`                  | boolean                       |                                                                                |
| `description`                                       | string                        |                                                                                |

## `conditionalLayers`

Auto-activate a layer when a set of other layers are all active.

| Field       | Type                | Notes                                |
| ----------- | ------------------- | ------------------------------------ |
| `ifLayers`  | string[] · required | Layer names that must all be active. |
| `thenLayer` | string · required   | Layer to activate.                   |

```json
{ "ifLayers": ["lower", "raise"], "thenLayer": "adjust" }
```

## Next

[Actions →](/reference/config/actions) · the full binding catalog
