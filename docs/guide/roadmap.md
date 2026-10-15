# Roadmap

Remappr is a **universal device manager**: one app to connect, remap, light up,
and build your devices — keyboards, mice and controllers — across firmwares. Today
it speaks **ZMK, QMK, VIA, Vial and Keychron**, plus its own
[Remappr Firmware](#remappr-firmware), in development; the architecture is
deliberately pluggable so **more firmwares** can join (see
[Future firmwares](#future-firmwares)).

Status: <Badge type="tip" text="✅ Done" /> <Badge type="warning" text="🚧 In Progress" /> <Badge type="info" text="🗓️ Planned" /> <Badge type="danger" text="🔮 Future" />

::: tip Two surfaces
Remappr has a **live editor** (edit a connected board over the ZMK Studio / VIA
protocol) and a **builder + config compiler** (design a board and export firmware
project files). A feature can be done on one and not the other — ZMK's
compile-time behaviors (combos, macros, tap-dance, encoders) are fully authored in
the builder/compiler but cannot be edited live on a board, by protocol design.
:::

## At a glance

| Area                                                                   | Status                                         |                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------- |
| [Keyboard Builder](#keyboard-builder)                                  | <Badge type="tip" text="✅ Done" />            | Design a board end-to-end          |
| [Config & compilers](#config-multi-firmware-compilers)                 | <Badge type="tip" text="✅ Done" />            | One config → 4 firmwares           |
| [Editor tools](#editor-tools)                                          | <Badge type="tip" text="✅ Done" />            | Heatmap, key test, RGB paint       |
| [Live editing — ZMK](#zmk-live-editor)                                 | <Badge type="tip" text="✅ Core" />            | Narrow by protocol                 |
| [Live editing — QMK/Vial/Keychron](#qmk-via-vial-keychron-live-editor) | <Badge type="tip" text="✅ Broad" />           | Rich VIA/Vial surface              |
| [Build & flash pipeline](#build-flash-pipeline)                        | <Badge type="warning" text="🚧 Partial" />     | Cloud build works; flasher planned |
| [Mice & controllers](#mice-controllers)                                | <Badge type="tip" text="✅ Done" />            | Device editor, live test, builder  |
| [Remappr Firmware](#remappr-firmware)                                  | <Badge type="warning" text="🚧 In Progress" /> | Mice & joysticks editable          |
| [Future firmwares](#future-firmwares)                                  | <Badge type="danger" text="🔮 Future" />       | Built to add more                  |

## Firmware support matrix

| Firmware                              | Live editor | Builder / export | Status                                         |
| ------------------------------------- | :---------: | :--------------: | ---------------------------------------------- |
| **ZMK** (wireless, BLE)               |     ✅      |        ✅        | <Badge type="tip" text="Supported" />          |
| **QMK**                               |     ✅      |        ✅        | <Badge type="tip" text="Supported" />          |
| **VIA**                               |     ✅      |        ✅        | <Badge type="tip" text="Supported" />          |
| **Vial**                              |     ✅      |        ✅        | <Badge type="tip" text="Supported" />          |
| **Keychron**                          |     ✅      |        ✅        | <Badge type="tip" text="Supported" />          |
| **Remappr Firmware** (first-party) ✨ |     🚧      |        —         | <Badge type="warning" text="🚧 In Progress" /> |

> More firmwares can be added over time — the [adapter + compiler
> architecture](#future-firmwares) is built for it. None besides Remappr Firmware
> are on the plan today.

---

## Keyboard Builder

The [builder](/guide/builder/overview) is feature-complete for designing a board.

| Feature                                                              | Status                         |
| -------------------------------------------------------------------- | ------------------------------ |
| Full-screen shell (toolbar · panels · canvas · inspector)            | <Badge type="tip" text="✅" /> |
| Start from preset · KLE import · ortho grid · blank                  | <Badge type="tip" text="✅" /> |
| Layout editing — drag / resize / rotate, snap & free-form            | <Badge type="tip" text="✅" /> |
| Matrix wiring — per-key row/col, overlay, pin labels, auto           | <Badge type="tip" text="✅" /> |
| Layers — add / duplicate / delete / rename / reorder                 | <Badge type="tip" text="✅" /> |
| Firmware-aware [binding picker](/guide/builder/layers-and-bindings)  | <Badge type="tip" text="✅" /> |
| [Identity & hardware form](/guide/builder/identity-and-hardware)     | <Badge type="tip" text="✅" /> |
| [Lighting](/guide/builder/lighting) — underglow + backlight          | <Badge type="tip" text="✅" /> |
| Encoders & analog sliders                                            | <Badge type="tip" text="✅" /> |
| Layout variants / VIA layout options                                 | <Badge type="tip" text="✅" /> |
| Save to / load from a keyboard library                               | <Badge type="tip" text="✅" /> |
| [JSON config panel](/reference/config/json-schema) (Monaco + schema) | <Badge type="tip" text="✅" /> |
| [Export & build](/guide/builder/export-build-flash) modal            | <Badge type="tip" text="✅" /> |
| Guided coachmark tour                                                | <Badge type="tip" text="✅" /> |

## Config & multi-firmware compilers

The [generalized config](/reference/config/overview) and compilers.

| Feature                                                                        | Status                          |
| ------------------------------------------------------------------------------ | ------------------------------- |
| Firmware-agnostic [keymap config](/reference/config/keymap-format)             | <Badge type="tip" text="✅" />  |
| [Normalize / serialize round-trip](/reference/config/normalization)            | <Badge type="tip" text="✅" />  |
| Zod validation + generated [JSON Schema](/reference/config/json-schema)        | <Badge type="tip" text="✅" />  |
| ZMK compiler — `.keymap` + `.overlay`, split                                   | <Badge type="tip" text="✅" />  |
| QMK compiler — `keymap.c` + `keyboard.json`                                    | <Badge type="tip" text="✅" />  |
| VIA definition · Vial definition (UID + unlock)                                | <Badge type="tip" text="✅" />  |
| Project bundle — repo + GitHub Actions + README                                | <Badge type="tip" text="✅" />  |
| [Capability gating](/reference/config/firmware-targets) · readiness · pin maps | <Badge type="tip" text="✅" />  |
| QMK C-scaffolding for combos / macros / tap-dance                              | <Badge type="info" text="🗓️" /> |

::: info
The QMK family currently emits warnings + `KC_NO` placeholders for combos,
macros and tap-dance in `keymap.c` — those behaviors are fully supported on **ZMK
export** and on **live Vial**. Generating the C scaffolding is the open item.
:::

## Build & flash pipeline

| Stage                                                                            | Status                             |
| -------------------------------------------------------------------------------- | ---------------------------------- |
| Cloud build — export a ready-to-push project; GitHub Actions builds the artifact | <Badge type="tip" text="✅" />     |
| One-click GitHub build (REST client + artifact proxy exist; not yet wired to UI) | <Badge type="warning" text="🚧" /> |
| In-app flasher (UF2 / DFU)                                                       | <Badge type="info" text="🗓️" />    |
| In-app local toolchain build                                                     | <Badge type="info" text="🗓️" />    |

## ZMK live editor

| Feature                                                              | Status                             |
| -------------------------------------------------------------------- | ---------------------------------- |
| Real-time keymap changes (no reflash)                                | <Badge type="tip" text="✅" />     |
| USB/serial (CDC-ACM) + BLE (BlueZ) transports                        | <Badge type="tip" text="✅" />     |
| Key / behavior assignment                                            | <Badge type="tip" text="✅" />     |
| Physical-layout selection · layer rename / add / reorder / count     | <Badge type="tip" text="✅" />     |
| Device lock / unlock (state observed; unlock by combo)               | <Badge type="tip" text="✅" />     |
| Basic hold-tap property config                                       | <Badge type="warning" text="🚧" /> |
| Live tap-dance/macro steps · live combos · live conditional layers   | <Badge type="info" text="🗓️" />    |
| Live encoder assignment · host-locale · devicetree import round-trip | <Badge type="info" text="🗓️" />    |
| New behavior / new layout creation on a live device                  | <Badge type="danger" text="🔮" />  |

All ZMK **bindings** (key/layer/output/lighting/power/mouse) and **composite
behaviors** (hold-tap, tap-dance, macros, mod-morph, sensor-rotation) are
<Badge type="tip" text="✅" /> in the builder + compiler — see
[Actions](/reference/config/actions). Live on-device editing of compile-time
behaviors is limited by the ZMK Studio protocol.

## QMK / VIA / Vial / Keychron live editor

| Feature                                                                          | Status                          |
| -------------------------------------------------------------------------------- | ------------------------------- |
| Raw-HID / VIA transport · layout sideload                                        | <Badge type="tip" text="✅" />  |
| Key / layer / modifier / media assignment · layer switching · one-shot mods      | <Badge type="tip" text="✅" />  |
| Mouse keys (movement / buttons / wheel)                                          | <Badge type="tip" text="✅" />  |
| Vial: tap-dance · combos · key overrides · macros · encoders · alt-repeat · lock | <Badge type="tip" text="✅" />  |
| VIA RGB underglow effect + color                                                 | <Badge type="tip" text="✅" />  |
| Keychron: per-key RGB · mixed-region RGB · wireless (LPM/NKRO/factory)           | <Badge type="tip" text="✅" />  |
| Keychron: dynamic debounce / report-rate / snap-click                            | <Badge type="tip" text="✅" />  |
| Bootmagic · full EEPROM reset · QMK Settings panel                               | <Badge type="info" text="🗓️" /> |
| Backlight-brightness · Auto-Shift · Caps-Word · One-Shot config panels           | <Badge type="info" text="🗓️" /> |

## Editor tools

| Feature                                                  | Status                         |
| -------------------------------------------------------- | ------------------------------ |
| Heatmap · live view · key test (HW matrix + OS fallback) | <Badge type="tip" text="✅" /> |
| Per-key RGB painting (Keychron / per-key QMK)            | <Badge type="tip" text="✅" /> |
| Typing load stats · wireless & advanced settings panels  | <Badge type="tip" text="✅" /> |
| Undo / redo · save / discard pending changes             | <Badge type="tip" text="✅" /> |

## App-level

| Feature                                           | Status                          |
| ------------------------------------------------- | ------------------------------- |
| Electron shell                                    | <Badge type="tip" text="✅" />  |
| Firmware adapter abstraction (plug-in per vendor) | <Badge type="tip" text="✅" />  |
| Capability-gated UI                               | <Badge type="tip" text="✅" />  |
| Keymap import / export (Remappr JSON config)      | <Badge type="tip" text="✅" />  |
| Auto-save ⇄ manual save, per firmware family      | <Badge type="tip" text="✅" />  |
| Per-device auto-connect on launch                 | <Badge type="tip" text="✅" />  |
| Local profile backup & restore (ZMK)              | <Badge type="tip" text="✅" />  |
| Read-only view of nodes behind a dongle           | <Badge type="tip" text="✅" />  |
| Editing a node behind a dongle                    | <Badge type="info" text="🗓️" /> |
| Cloud sync / backup · profile sharing             | <Badge type="info" text="🗓️" /> |

---

## Mice & controllers

Devices that are not keyboards open in the
[device editor](/guide/devices/overview), drawn in their own shape.

| Feature                                                                                         | Status                             |
| ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| [Device editor](/guide/devices/device-editor): stage, callouts, per-control inspector, profiles | <Badge type="tip" text="✅" />     |
| Demo mouse, gamepad, flight stick and layout-less controller                                    | <Badge type="tip" text="✅" />     |
| [Generic controllers & mice](/guide/devices/generic-hid): view + live test                      | <Badge type="tip" text="✅" />     |
| [Builder device layouts](/guide/builder/device-layout): design or re-draw a device              | <Badge type="tip" text="✅" />     |
| [Remappr Firmware mice & joysticks](#remappr-firmware): full editing                            | <Badge type="warning" text="🚧" /> |
| Other vendors' mice (Keychron mice, QMK pointing devices)                                       | <Badge type="info" text="🗓️" />    |

## Remappr Firmware

Remappr's own firmware, written alongside the app, is in active development.
Its devices tell Remappr what they are and where their controls sit, so the
app draws and edits them with no per-model setup.

| Feature                                                                                                                                         | Status                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [Mice](/guide/devices/mice#remappr-firmware-mice): button actions, DPI stages & sniper, polling rate, pointer & acceleration settings           | <Badge type="warning" text="🚧" /> |
| [Joysticks](/guide/devices/gamepads#remappr-firmware-joysticks): gamepad or flight stick, stick deadzones & curves, hat, calibration, live view | <Badge type="warning" text="🚧" /> |
| 2.4 GHz dongle: a mouse behind the dongle, read-only                                                                                            | <Badge type="warning" text="🚧" /> |
| A joystick behind the dongle                                                                                                                    | <Badge type="info" text="🗓️" />    |
| Keyboards                                                                                                                                       | <Badge type="warning" text="🚧" /> |
| Editing a device through the dongle                                                                                                             | <Badge type="info" text="🗓️" />    |

🚧 here means built and working in the app, with hardware verification still
under way.

## Future firmwares

::: tip ✨ The north star: Remappr Firmware
The long-term vision is a **first-party Remappr Firmware** — a native firmware the
manager controls end-to-end. Third-party protocols cap what can be edited _live_
(ZMK Studio can't author combos, macros, tap-dance, encoders or new behaviors on a
connected board; VIA/Vial vary by build). A firmware designed alongside the app
removes that ceiling: everything you can design in the
[builder](/guide/builder/overview) becomes editable on the device in real time,
from one [config](/reference/config/overview). Until then, every feature lands on
the firmwares below.

<Badge type="warning" text="🚧 In Progress" /> — mice and joysticks first, see
[Remappr Firmware](#remappr-firmware).
:::

Remappr's goal is to be **firmware-agnostic**. Two extension points make new
firmwares tractable:

- A **[firmware adapter](/dev/project-structure#the-adapter-pattern)** for the
  _live_ surface — probe a connected device, expose a `KeyboardService` with
  capability-gated facades. The UI adapts automatically.
- A **[compiler Strategy](/dev/compilers)** for the _export_ surface — lower the
  generalized config to that firmware's project files, registered in the
  capability matrix.

On the plan:

| Firmware                | Notes                                                         | Status                                         |
| ----------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| **Remappr Firmware** ✨ | First-party firmware — full live control, no protocol ceiling | <Badge type="warning" text="🚧 In Progress" /> |

No other firmwares are planned right now — but thanks to those two extension
points, new ones (a CircuitPython firmware, a vendor's VIA/Vial channels, bare
HID, …) can be added if demand appears. Want to add one? See
[Adding a firmware target](/dev/adding-a-firmware-target).

---

The authoritative, per-behavior status table also lives in the
[project README](https://github.com/Wolffyx/remappr#readme).
