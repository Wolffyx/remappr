# Device document

A keyboard's settings are a [keymap config](/reference/config/overview)
(`"kind": "remappr.keymap"`). A Remappr Firmware device that is **not** a
keyboard (a mouse, a joystick, a 2.4 GHz dongle) has a smaller document of its
own, `"kind": "remappr.device"`. It is what **Export profiles** downloads as
`remappr.device.json` and what **Save** writes to the device.

```json
{
    "schemaVersion": 1,
    "kind": "remappr.device",
    "meta": { "name": "Bench stick" },
    "personality": "joystick",
    "joystick": {
        "hatWays": 4,
        "axes": [{ "input": 1, "out": "y", "invert": true }]
    }
}
```

**Every setting is optional.** A field left out keeps the firmware's default,
so a document only lists what differs. The ranges below are the firmware's, so
a document that validates is never refused for a range.

## The top-level document

| Field           | Type                                        | Notes                                                                      |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| `schemaVersion` | `1`                                         |                                                                            |
| `kind`          | `"remappr.device"`                          |                                                                            |
| `meta`          | `{ name, author?, version?, description? }` | `version` is the config version of an exported blob (an integer string).   |
| `personality`   | `"mouse"` \| `"joystick"` \| `"dongle"`     | Which device the document is for. A device refuses a document for another. |
| `mouse`         | [Mouse](#mouse)                             | Mouse only.                                                                |
| `radio`         | [Radio](#radio)                             | Mouse only.                                                                |
| `joystick`      | [Joystick](#joystick)                       | Joystick only.                                                             |
| `dongle`        | [Dongle](#dongle)                           | Dongle only.                                                               |

A section that belongs to another kind of device is an error (_"a joystick
config has no "mouse" section"_), not silently ignored.

## Mouse

| Field                         | Type                            | Notes                                                                                             |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `cpi`                         | 0–65535                         | Sensor DPI. Left out = the sensor's own. With `dpiStages`, the starting stage sets it.            |
| `dpiStages`                   | 1–5 values, each 1–65535        | The DPIs the DPI buttons step through.                                                            |
| `dpiStage`                    | 0–4                             | The stage the mouse starts on; must index into `dpiStages`.                                       |
| `accel`                       | up to 255 `[speedIn, multX100]` | Acceleration curve: above `speedIn` (counts per report), motion × `multX100` / 100. Empty = flat. |
| `invertX`, `invertY`          | boolean                         | Invert an axis.                                                                                   |
| `invertWheel`, `invertHwheel` | boolean                         | Invert the wheel or the horizontal wheel.                                                         |
| `swapXY`                      | boolean                         | Swap X and Y, before the inverts.                                                                 |
| `scrollDivisor`               | 1–16                            | Wheel counts per reported scroll step (default 1).                                                |
| `buttonMap`                   | 8 × (0–7 or `null`)             | Physical button _i_ reports as HID button `buttonMap[i]`; `null` drops it.                        |
| `buttonActions`               | 8 × (action or `null`)          | What button _i_ does instead of its `buttonMap` entry; `null` = the map.                          |
| `autoLayerTimeoutMs`          | 0–65535                         | Auto-layer timeout, ms.                                                                           |

A **mouse button action** is one of:

| `action`   | Does                                   |
| ---------- | -------------------------------------- |
| `dpiCycle` | Next DPI stage, wrapping round         |
| `dpiUp`    | One stage up, stopping at the top      |
| `dpiDown`  | One stage down, stopping at the bottom |
| `dpiSet`   | Jump to `dpi` (required)               |
| `sniper`   | Hold `dpi` (required) while pressed    |

```json
"mouse": {
    "dpiStages": [800, 1600, 3200],
    "dpiStage": 1,
    "invertWheel": true,
    "buttonActions": [null, null, null, null, { "action": "dpiCycle" }, { "action": "sniper", "dpi": 400 }, null, null]
}
```

The polling rate is not in the document: it belongs to the mouse, and is set
from the device editor.

## Radio

How a mouse talks to its dongle over 2.4 GHz.

| Field          | Type      | Notes                                                                  |
| -------------- | --------- | ---------------------------------------------------------------------- |
| `autoPair`     | boolean   | Open pairing on its own while unbonded (default on).                   |
| `keepaliveMs`  | 20–1000   | Idle re-send period (default 40). Keep it below the dongle's failsafe. |
| `beaconLossMs` | 200–10000 | No dongle beacon for this long means the link is lost (default 600).   |
| `inputRepeats` | 1–8       | Sends per input change (default 3).                                    |

## Joystick

| Field           | Type                                | Notes                                                                                   |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `hatWays`       | `4` \| `8`                          | Default 8. A 4-way hat reports a diagonal as its vertical.                              |
| `axes`          | up to 6 [axis entries](#axis-entry) | One entry per analog input that differs from its default.                               |
| `buttonActions` | up to 40 × (action or `null`)       | By binding position: what the button does instead of its default; `null` = the default. |

### Axis entry

| Field    | Type                                      | Notes                                                                        |
| -------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `input`  | 0–5                                       | The analog input. Input _n_ defaults to the \_n_th axis (0 → `x`, 1 → `y`…). |
| `out`    | `x` `y` `z` `rx` `ry` `rz`, or `null`     | The report axis it drives; `null` turns it off.                              |
| `invert` | boolean                                   |                                                                              |
| `curve`  | `linear` `aggressive` `relaxed` `precise` | Default `linear`.                                                            |
| `inner`  | 0–99                                      | Inner deadzone, % of travel.                                                 |
| `outer`  | 0–99                                      | Outer deadzone, %. `inner` + `outer` must stay under 100.                    |

A stick is two inputs: stick _n_ reads inputs 2*n* and 2*n*+1.

### Joystick button actions

| `action` | Fields                       | Does                                                         |
| -------- | ---------------------------- | ------------------------------------------------------------ |
| `none`   |                              | Nothing: the button is off.                                  |
| `button` | `button` 1–32                | Press a gamepad button.                                      |
| `hat`    | `dir` 0–7                    | Hold the hat: 0 up, then clockwise (1 up-right … 7 up-left). |
| `axis`   | `axis`, `value` −32767–32767 | Hold an axis at `value` while pressed.                       |

Left at its default (`null`), a d-pad button moves the hat and any other
button presses the gamepad button of its position + 1.

Calibration is not in the document: it is kept on the stick. See
[Calibration](/guide/devices/gamepads#calibration).

## Dongle

| Field                | Type        | Notes                                                                               |
| -------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `nkro`               | boolean     | Send keystrokes over the NKRO interface (`true`) or boot 6KRO (`false`, BIOS-safe). |
| `pairWindowMs`       | 5000–600000 | How long the pairing window stays open (default 30000).                             |
| `pairDoneReplayMs`   | 0–30000     | After a bond, how long a lost pairing confirmation is replayed (default 2000).      |
| `failsafeMs`         | 50–2000     | A node silent this long gets an all-keys-up report (default 100).                   |
| `rosterLiveMs`       | 100–60000   | A node silent this long is listed offline (default 1500). Not below `failsafeMs`.   |
| `hidSubmitTimeoutMs` | 0–50        | How long a USB report waits for the host before it is held (default 2).             |

## Next

- [Mice](/guide/devices/mice) · [Gamepads & flight sticks](/guide/devices/gamepads)
- [JSON keymap config](/reference/config/overview), for keyboards
