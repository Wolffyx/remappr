# Identity & hardware

The settings in the left panel hold everything about the board that is not its
layout or bindings — name, USB identity, firmware targets, controller, matrix,
lighting and firmware config. These fields turn a keymap into a _flashable_
project. They sit in five groups, one open at a time: **Board**, **Firmware**,
**Lighting**, **Behavior** and **Readiness**; **Filter settings** at the top
narrows them, and [search](/guide/builder/overview#search) (`/`) jumps to any
one. Sections appear/disappear based on the firmware targets you select.

![The top of the Board group: Identity and USB identifiers](/images/builder/identity.webp){width=300}

Every field below is labelled exactly as it appears in the panel, with the
config key it writes.

## Identity

| Field                   | Writes        | Notes                                               |
| ----------------------- | ------------- | --------------------------------------------------- |
| **Keyboard name**       | `meta.name`   | Display name; seeds the export project/shield name. |
| **Author / maintainer** | `meta.author` |                                                     |

## USB identifiers

| Field          | Writes           | Placeholder |
| -------------- | ---------------- | ----------- |
| **Vendor ID**  | `meta.vendorId`  | `0xFEED`    |
| **Product ID** | `meta.productId` | `0x0001`    |

Required for the QMK family.

## Firmware targets

One card per target; click to toggle, and several can be on at once. Selecting
them fills `keyboard.firmware[]`:

| Target      | Card blurb                             |
| ----------- | -------------------------------------- |
| **QMK**     | C firmware · info.json + keymap        |
| **VIA**     | Live remap · v3 definition             |
| **Vial**    | On-device · VIA + vial.json            |
| **ZMK**     | Wireless · devicetree keymap           |
| **Remappr** | Wireless · Zephyr shield + config blob |

An info line under the cards summarises the choice — _"Keyboard type · Wired +
wireless"_ (or wired / wireless only) and _"Keycodes & behaviours follow ZMK +
Remappr"_. VIA and Vial compile through QMK. See
[Firmware targets](/reference/config/firmware-targets).

## Feature cards {#feature-cards}

_"What should it do?"_ — the same cards for every design, keyboard or device,
because any part can go on any design (a trackball on a keyboard, a knob on a
mouse):

- **Connection & power:** **Wireless** (Bluetooth or a 2.4 GHz dongle),
  **Edit live from the app**, **Battery & sleep**, **Lighting**.
- **Parts:** **Motion sensor** (an optical sensor or trackball on SPI),
  **Encoders** (a scroll wheel or knobs), **Analog inputs** (sticks, triggers,
  sliders).

Each says what it needs wired (e.g. _"LED data pin"_). The kind of design only
marks some **Suggested** — a mouse starts with sensor and encoders on, a gamepad
with analog inputs. Each card's firmware chips come from that firmware's own
table, crossed out where it has no option for that part. _"Each card sets the
right options for"_ every firmware you picked; the picks are saved in
`keyboard.features` (a device keeps them with its design). They are step 3 of a
[new design](/guide/builder/overview#starting-a-board), and **Pick…** /
**Change…** in the Firmware group opens them later.

::: tip
Turning off **Edit live from the app** also turns off the firmware's live-edit
support (for ZMK, ZMK Studio), on purpose.
:::

## Firmware tabs {#firmware-tabs}

Under the targets, the **Firmware** group has one tab per firmware you picked
(e.g. **ZMK** · **Remappr**). Each tab lists that firmware's own switches, with
the exact line it writes under the name (e.g. `CONFIG_ZMK_BLE=y`):

- **from {feature}** — the switch was turned on by a feature card.
- **changed** — set by hand. The tab header counts them (_"2 changed from
  defaults"_) and **Reset** puts them back; with none changed it names the file
  it writes (_"Writes .conf"_).
- A **· sub-switch** only applies while the switch above it is on.
- Some switches are fixed by the board and show their state instead of a toggle.

The extra lines, generated files and firmware-specific sections below
(**Firmware config**, **Hardware pins**, **Vial security**…) follow the tab.

## Controller

![Controller and Matrix: board and shield, the 4 × 6 matrix with Auto, diode direction, scan mode and pin mapping](/images/builder/controller-matrix.webp){width=300}

Writes `keyboard.controller`. Fields shown depend on the targets:

| Field                | Writes                        | Placeholder    | For       |
| -------------------- | ----------------------------- | -------------- | --------- |
| **Board**            | `controller.board`            | `nice_nano_v2` | ZMK / QMK |
| **Shield (opt.)**    | `controller.shield`           | `corne_left`   | ZMK       |
| **Processor (QMK)**  | `controller.processor`        | `atmega32u4`   | QMK       |
| **Bootloader (QMK)** | `controller.bootloader`       | `atmel-dfu`    | QMK       |
| **Dev board (QMK)**  | `controller.developmentBoard` | `promicro`     | QMK       |
| **Device version**   | `controller.deviceVersion`    | `1.0.0`        | QMK       |

> _"ZMK uses board + optional shield. QMK uses processor + bootloader (or a
> dev-board shortcut) + USB device version."_

## Matrix

The board-level matrix descriptor (`keyboard.matrix`) plus pin labels
(`keyboard.pins`):

| Control             | Writes                    | Options                                                   |
| ------------------- | ------------------------- | --------------------------------------------------------- |
| **Diode direction** | `matrix.diodeDirection`   | `COL2ROW` / `ROW2COL`                                     |
| **Scan mode**       | `matrix.mode`             | Matrix (row × col) / Direct (1 GPIO/key)                  |
| **Pin mapping**     | `pins.rows` / `pins.cols` | `row pins` / `col pins`                                   |
| **Auto**            | per-key `matrix`          | _"Auto assigns each key's row/column from its position."_ |

The display reads e.g. `4 × 6 · rows × columns per half · 42 keys` (`· wired`
when keys have matrix positions). Per-key wiring is in the [inspector](/guide/builder/inspector#matrix-wiring-row-column).

## Capabilities

| Toggle                | Writes           |
| --------------------- | ---------------- |
| **Split / two-piece** | `keyboard.split` |

## Lighting

![Lighting: the RGB underglow and per-key backlight switches](/images/builder/lighting.webp){width=300}

Writes `keyboard.lighting`; _"Configured for every firmware target — the exporter
maps it to each platform."_

| Control                    | Writes                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| **RGB underglow**          | `lighting.underglow` (on)                                         |
| — **Effect**               | `underglow.effect` — solid / breathe / rainbow / swirl / gradient |
| — **Color**                | `underglow.hue` (or Rainbow)                                      |
| — **Brightness**           | `underglow.brightness`                                            |
| **Per-key backlight**      | `lighting.backlight` (on)                                         |
| — **Backlight brightness** | `backlight.brightness`                                            |
| — **Breathing**            | `backlight.breathing`                                             |

See [Lighting](/guide/builder/lighting) for the full picture (actions vs config).

## Firmware config (.conf) — ZMK

![Firmware config (.conf): the Kconfig toggles and the Extra firmware settings box](/images/builder/firmware-config.webp){width=300}

Toggles that derive the ZMK `.conf`, writing `keyboard.firmwareConfig`. A live
**Generated .conf** preview updates as you flip them. **Extra firmware settings (Kconfig)** (e.g.
`CONFIG_ZMK_SLEEP=y`) is appended verbatim.

| Toggle                     | Derives                     |
| -------------------------- | --------------------------- |
| **USB**                    | `CONFIG_ZMK_USB`            |
| **Bluetooth (BLE)**        | `CONFIG_ZMK_BLE`            |
| **ZMK Studio**             | `CONFIG_ZMK_STUDIO`         |
| **Studio over USB (CDC)**  | Studio CDC block            |
| **Studio unlock required** | `CONFIG_ZMK_STUDIO_LOCKING` |
| **Soft-off**               | `CONFIG_ZMK_PM_SOFT_OFF`    |
| **External power**         | `CONFIG_ZMK_EXT_POWER`      |
| **Pointing (mouse)**       | `CONFIG_ZMK_POINTING`       |
| **USB logging**            | `CONFIG_ZMK_USB_LOGGING`    |

Each is **tri-state** — left alone it auto-derives from used behaviors/hardware;
toggling sets an explicit override. See
[Firmware config](/reference/config/hardware#firmware-config).

## Hardware pins — ZMK {#hardware-pins-zmk}

![Hardware pins: the external-power control GPIO and Active low](/images/builder/hardware-pins.webp){width=300}

Appears when a feature needs a pin — here, after turning **RGB underglow** on. Friendly nRF labels like `P0.13` emit psels;
_"verify against your board wiring."_ Writes `keyboard.hardware`.

| Section                    | Fields                                                     | Writes                  |
| -------------------------- | ---------------------------------------------------------- | ----------------------- |
| **Ext-power control GPIO** | pin (`P0.14`), **Active low**                              | `hardware.extPowerCtrl` |
| **Backlight PWM**          | pin (`P0.13`), instance (`pwm0`), **Inverted**             | `hardware.backlightPwm` |
| **WS2812 underglow**       | data pin (`P1.13`), LEDs, color order (GRB…), SPI (`spi3`) | `hardware.ws2812`       |

## Timing & defaults

Board-wide behavior timings, written to the config's top-level
[`defaults`](/reference/config/keymap-format#defaults). Every field is optional:
_"Blank = the firmware / devicetree default."_

![Timing and defaults: Tap-hold & combo, Debounce and Engine timing groups, all on auto, with Learn more](/images/builder/timing.webp){width=300}

| Group                | Field                   | Writes                    | Meaning                                              |
| -------------------- | ----------------------- | ------------------------- | ---------------------------------------------------- |
| **Tap-hold & combo** | Tapping term            | `tappingTermMs`           | Hold-vs-tap decision window.                         |
|                      | Quick tap               | `quickTapMs`              | Tap-then-hold within this window repeats the tap.    |
|                      | Combo timeout           | `comboTimeoutMs`          | Max time between the keys of a combo.                |
| **Debounce**         | Release debounce        | `releaseDebounceMs`       | 0 keeps the firmware / devicetree value.             |
|                      | Press debounce          | `pressDebounceMs`         | ″                                                    |
|                      | Matrix press debounce   | `matrixPressDebounceMs`   | ″                                                    |
|                      | Matrix release debounce | `matrixReleaseDebounceMs` | ″                                                    |
| **Engine timing**    | Caps-word idle          | `capsWordIdleMs`          | Auto-exit caps-word after this idle time; 0 = never. |
|                      | Sticky release          | `stickyReleaseDefaultMs`  | Sticky-key lifetime; 0 = until the next key.         |
|                      | Macro default wait      | `macroDefaultWaitMs`      | Default gap between macro steps.                     |
|                      | Macro default tap       | `macroDefaultTapMs`       | Default tap hold-time inside a macro.                |
|                      | Matrix poll period      | `matrixPollPeriodMs`      | Matrix scan interval; 0 keeps the devicetree value.  |

The **Engine timing** fields apply on Remappr Firmware. The same fields are
editable live on a connected board in the editor's
[Timing and defaults](/guide/app/advanced#timing-defaults) dialog.

## Behaviors (hold-taps & mod-morphs)

_"Custom hold-tap and mod-morph defs the keymap can bind. Add one below, then
tune its behaviors, timing and modifiers."_

![Behaviors: a new hold-tap (Hold-tap 1, ht_1) with Hold and Tap behaviors, flavor, timings and toggles, a new mod-morph, and Add hold-tap / Add mod-morph](/images/builder/behaviors.webp){width=300}

- **+ Add hold-tap** — a new definition (`ht_1`, `ht_2`…) in
  [`holdTaps`](/reference/config/keymap-format#holdtaps): the **Hold** and **Tap**
  behaviors (`&kp`, `&mo`, `&lt`, `&mt`, `&sk`, `&sl`, `&kt`, `&trans`),
  **Flavor** (_balanced_, _hold-preferred_, _tap-preferred_,
  _tap-unless-interrupted_), **Tapping term**, **Quick tap**, **Require prior
  idle**, and the **Retro tap** / **Trigger hold on release** switches.
  **Remove** deletes it.
- **+ Add mod-morph** — a key that sends something else while a modifier is held,
  in [`modMorphs`](/reference/config/keymap-format#modmorphs).

Once defined, a hold-tap or mod-morph shows up in the binding picker as an action
you can put on any key.

## Conditional layers (tri-layer)

_"Auto-activate a layer while a combination of others is held."_ **+ Add
tri-layer** adds a rule to
[`conditionalLayers`](/reference/config/keymap-format#conditionallayers): pick the
layers that must all be active and the layer they turn on — the classic
_lower_ + _raise_ → _adjust_.

## Firmware config (config.h / rules.mk) — QMK

For the QMK family: **Extra config.h** (`#define TAPPING_TERM 180`) and **Extra
rules.mk** (`MOUSEKEY_ENABLE = yes`), each with a live **Generated** preview.
Writes `firmwareConfig.configH` / `firmwareConfig.rulesMk`.

## Vial security

Shown when **Vial** is a target. Writes `keyboard.vial`:

| Control                                         | Writes            |
| ----------------------------------------------- | ----------------- |
| **Keyboard UID (8 bytes)** + **Generate**       | `vial.uid`        |
| **Unlock combo (row,col …)** + **Add selected** | `vial.unlockKeys` |
| **Insecure (no unlock required)**               | `vial.insecure`   |

> _"Vial ties a flashed board to its definition by UID and locks the keymap until
> the unlock keys are held. Select keys on the board, then 'Add selected'."_

## Layout options

Shown for VIA/Vial. Writes `keyboard.layoutOptions`; keys tag in via the
inspector's **Layout variant**.

- **Option label** + **Choices, comma-separated (blank = toggle)** → **Add
  option**. _"A blank choices field is an on/off toggle; two or more choices make
  a dropdown."_
- Per-option **Tag → {choice}** and **Untag selected** tag the current selection.

## Readiness

The **Readiness** strip at the bottom of the panel shows a chip per target —
✓ when it can build, ⚠ when it builds with warnings, ⊗ when something blocking is
missing; hover a chip for the list. This
is the same check the [export modal](/guide/builder/export-build-flash#readiness)
runs.

## A filled-in example

```json
"meta": { "name": "My Split", "vendorId": "0xFEED", "productId": "0x0001", "target": null },
"keyboard": {
  "id": "my_split",
  "name": "My Split",
  "firmware": ["zmk"],
  "controller": { "board": "nice_nano_v2", "shield": "my_split_left" },
  "matrix": { "rows": 4, "cols": 6, "diodeDirection": "col2row", "mode": "matrix" },
  "split": true,
  "firmwareConfig": { "ble": true, "studio": true }
}
```

## Next

[Lighting →](/guide/builder/lighting)
