# Remappr

A **universal device manager** — one app to connect, remap, light up and build
your devices across firmwares. Supports **ZMK, QMK, VIA, Vial and Keychron** today,
with a pluggable adapter + compiler architecture built to add more firmwares over
time — including a planned first-party **Remappr Firmware**. Built on Electron,
with a single React UI driving the firmware adapters.

📖 **Documentation:** [docs.remappr.com](https://docs.remappr.com) — the Builder
walkthrough, the JSON keymap config reference, and developer/compiler docs.
Source lives in [`docs/`](docs) (VitePress); run it with `pnpm docs:dev`.

## Stack

- **UI:** React 19, Vite 7, Tailwind 4, shadcn/ui, react-aria-components
- **Shell:** Electron 39
- **State:** Zustand, Immer
- **Firmware adapters:** ZMK (BLE/serial), QMK (raw HID via VIA), Vial, Keychron
- **Testing:** Vitest, Storybook 10

## Prerequisites

- Node.js >= 20 (see `.nvmrc`)
- pnpm 10.30.x — managed via the `packageManager` field; install with
  `corepack enable` if needed
- Linux only: BlueZ + D-Bus running for direct GATT (BLE) access
- macOS only: Xcode command-line tools for `node-hid` / `serialport` builds

## Setup

```bash
pnpm install
```

`postinstall` runs `electron-builder install-app-deps` to compile the
native modules (`node-hid`, `serialport`, `dbus-next`) against Electron's
ABI.

## Development

| Command          | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `pnpm edev`      | Electron dev (renderer + main + preload, hot reload)       |
| `pnpm dev`       | Renderer-only Vite dev server (port 5174, browser preview) |
| `pnpm storybook` | Storybook on port 6006                                     |

## Quality gates

```bash
pnpm typecheck      # tsc --noEmit (node + web projects)
pnpm lint           # eslint with --report-unused-disable-directives
pnpm test           # vitest run
pnpm format         # prettier --write .
```

## Build

```bash
pnpm ebuild         # typecheck + electron-vite build (no installer)
pnpm build:linux    # electron-builder Linux installer
pnpm build:mac      # electron-builder macOS installer
pnpm build:win      # electron-builder Windows installer
pnpm build          # Vite-only renderer build (browser preview)
```

## Layout

```
src/
  main/        Electron main process: BLE, HID, serial, IPC, lifecycle
  preload/     Context-isolated bridge — whitelisted IPC surface
  renderer/    React app (Vite root)
  firmware/    Firmware adapters (zmk, qmk, qmk-vial, keychron, mock)
  shared/      Cross-process types + logger
docs/firmware/ Per-vendor adapter notes
```

## Roadmap

> ✅ Done · 🚧 In Progress · 🗓️ Planned · 🔮 Future (fork goals beyond upstream)

Full status, screenshots and field-by-field docs live at
[docs.remappr.com](https://docs.remappr.com).

> **Two surfaces.** Remappr has a **live editor** (edit a connected board over
> the ZMK Studio / VIA protocol) and a **builder + config compiler** (design a
> board and export firmware project files). A feature can be done on one and not
> the other — ZMK's compile-time behaviors (combos, macros, tap-dance, encoders)
> are fully authored in the builder/compiler but cannot be edited live on a board,
> by protocol design. Status below notes the surface where it differs.

#### Firmware support

| Firmware                              | Live editor | Builder / export | Status    |
| ------------------------------------- | :---------: | :--------------: | --------- |
| ZMK (wireless, BLE)                   |     ✅      |        ✅        | Supported |
| QMK                                   |     ✅      |        ✅        | Supported |
| VIA                                   |     ✅      |        ✅        | Supported |
| Vial                                  |     ✅      |        ✅        | Supported |
| Keychron                              |     ✅      |        ✅        | Supported |
| **Remappr Firmware** (first-party) ✨ |      —      |        —         | 🔮 Future |

> More firmwares can be added over time — the adapter + compiler architecture is
> built for it. None besides Remappr Firmware are on the plan today.

### Keyboard Builder

| Status | Feature                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------- |
| ✅     | Full-screen builder (toolbar · layers/build/identity panel · canvas · inspector)               |
| ✅     | Start from a preset, KLE import, ortho grid, or blank                                          |
| ✅     | Physical layout editing — drag / resize / rotate, snap & free-form, ⅛U snapping                |
| ✅     | Matrix wiring — per-key row/col, wiring overlay, friendly pin labels, auto-assign              |
| ✅     | Layers — add / duplicate / delete / rename / reorder                                           |
| ✅     | Firmware-aware binding picker                                                                  |
| ✅     | Identity form — USB ids, controller, firmware targets, matrix, Vial UID/unlock, layout options |
| ✅     | Lighting config — RGB underglow + per-key backlight                                            |
| ✅     | Encoders & analog sliders                                                                      |
| ✅     | Physical-layout variants / VIA layout options                                                  |
| ✅     | Save to / load from a keyboard library                                                         |
| ✅     | JSON config panel (Monaco) with live schema validation + autocomplete                          |
| ✅     | Export & build modal — per-firmware readiness checklist + project `.zip`                       |
| ✅     | Guided coachmark tour                                                                          |

### Generalized config & multi-firmware compilers

| Status | Feature                                                                                 |
| ------ | --------------------------------------------------------------------------------------- |
| ✅     | Generalized, firmware-agnostic keymap config (single source of truth)                   |
| ✅     | Surface ↔ canonical normalize / serialize round-trip (preserves your spelling)          |
| ✅     | Zod schema validation + generated JSON Schema (IDE validation/autocomplete)             |
| ✅     | ZMK compiler — `.keymap` + physical-layout `.overlay`, split support                    |
| ✅     | QMK compiler — `keymap.c` + data-driven `keyboard.json`                                 |
| ✅     | VIA definition export · Vial definition export (UID + unlock combo)                     |
| ✅     | Project bundle generator — repo skeleton + GitHub Actions workflow + README             |
| ✅     | Per-firmware capability gating · readiness checks · pin-map resolution                  |
| 🗓️     | QMK C-scaffolding for combos / macros / tap-dance (emits warnings + placeholders today) |

### Build & flash pipeline

| Status | Feature                                                                                |
| ------ | -------------------------------------------------------------------------------------- |
| ✅     | Cloud build — export a ready-to-push project; GitHub Actions builds the artifact       |
| 🚧     | One-click GitHub build (REST client + artifact proxy exist; not yet wired into the UI) |
| 🗓️     | In-app flasher (UF2 / DFU)                                                             |
| 🗓️     | In-app local toolchain build                                                           |

---

### ZMK (live editor)

#### Core Studio Features

| Status                                                     | Feature                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| <abbr title="Done">✅</abbr>                               | Real-time keymap changes (no reflash)                        |
| <abbr title="Done">✅</abbr>                               | USB / serial (CDC-ACM) transport                             |
| <abbr title="Done">✅</abbr>                               | BLE transport (Linux native via BlueZ)                       |
| <abbr title="Done">✅</abbr>                               | Key / behavior assignment                                    |
| <abbr title="Done">✅</abbr>                               | Alternative physical layout selection                        |
| <abbr title="Done">✅</abbr>                               | Layer renaming                                               |
| <abbr title="Done">✅</abbr>                               | Extra layer enabling                                         |
| <abbr title="Done">✅</abbr>                               | Layer count expansion (add layers live)                      |
| <abbr title="Done">✅</abbr>                               | Device lock / unlock (state observed; unlock by combo)       |
| <abbr title="In Progress">🚧</abbr>                        | Basic behavior property configuration (hold-tap timing)      |
| <abbr title="Planned">🗓️</abbr>                            | Advanced behavior properties (tap-dance params, macro steps) |
| <abbr title="Planned">🗓️</abbr>                            | Live combo configuration                                     |
| <abbr title="Planned">🗓️</abbr>                            | Live conditional layer setup                                 |
| <abbr title="Planned">🗓️</abbr>                            | Host locale / HID locale selection                           |
| <abbr title="Planned">🗓️</abbr>                            | Keymap import (devicetree → editable round-trip)             |
| <abbr title="Planned">🗓️</abbr>                            | Live encoder behavior assignment                             |
| <abbr title="Future — fork goal beyond upstream">🔮</abbr> | New behavior definition on a live device                     |
| <abbr title="Future — fork goal beyond upstream">🔮</abbr> | New physical layout creation on a live device                |

> Combos, conditional layers, encoders, macros and tap-dances are **authored in
> the Builder + config compiler** (see above) and export to a flashable project;
> live on-device editing of these compile-time behaviors is limited by the ZMK
> Studio protocol.

#### ZMK Behaviors — Binding Support

Coverage below is the **builder + ZMK compiler** (export); supported behaviors
are also bindable live when the connected board exposes them.

**Key Press**

| Status                       | Behavior     | Tag           |
| ---------------------------- | ------------ | ------------- |
| <abbr title="Done">✅</abbr> | Key Press    | `&kp`         |
| <abbr title="Done">✅</abbr> | Mod-Tap      | `&mt`         |
| <abbr title="Done">✅</abbr> | Key Toggle   | `&kt`         |
| <abbr title="Done">✅</abbr> | Sticky Key   | `&sk`         |
| <abbr title="Done">✅</abbr> | Grave Escape | `&gresc`      |
| <abbr title="Done">✅</abbr> | Caps Word    | `&caps_word`  |
| <abbr title="Done">✅</abbr> | Key Repeat   | `&key_repeat` |
| <abbr title="Done">✅</abbr> | Transparent  | `&trans`      |
| <abbr title="Done">✅</abbr> | None / Block | `&none`       |

**Layer Navigation**

| Status                       | Behavior        | Tag    |
| ---------------------------- | --------------- | ------ |
| <abbr title="Done">✅</abbr> | Momentary Layer | `&mo`  |
| <abbr title="Done">✅</abbr> | Layer-Tap       | `&lt`  |
| <abbr title="Done">✅</abbr> | To Layer        | `&to`  |
| <abbr title="Done">✅</abbr> | Toggle Layer    | `&tog` |
| <abbr title="Done">✅</abbr> | Sticky Layer    | `&sl`  |

**Bluetooth & Output**

| Status                       | Behavior                    | Tag    |
| ---------------------------- | --------------------------- | ------ |
| <abbr title="Done">✅</abbr> | Bluetooth control           | `&bt`  |
| <abbr title="Done">✅</abbr> | Output selection (BT / USB) | `&out` |

**Reset & Boot**

| Status                       | Behavior      | Tag              |
| ---------------------------- | ------------- | ---------------- |
| <abbr title="Done">✅</abbr> | System Reset  | `&sys_reset`     |
| <abbr title="Done">✅</abbr> | Bootloader    | `&bootloader`    |
| <abbr title="Done">✅</abbr> | Studio Unlock | `&studio_unlock` |

**Lighting**

| Status                       | Behavior      | Tag       |
| ---------------------------- | ------------- | --------- |
| <abbr title="Done">✅</abbr> | RGB Underglow | `&rgb_ug` |
| <abbr title="Done">✅</abbr> | Backlight     | `&bl`     |

**Power Management**

| Status                       | Behavior       | Tag          |
| ---------------------------- | -------------- | ------------ |
| <abbr title="Done">✅</abbr> | External Power | `&ext_power` |
| <abbr title="Done">✅</abbr> | Soft Off       | `&soft_off`  |

**Mouse Emulation**

| Status                       | Behavior     | Tag    |
| ---------------------------- | ------------ | ------ |
| <abbr title="Done">✅</abbr> | Mouse Button | `&mkp` |
| <abbr title="Done">✅</abbr> | Mouse Move   | `&mmv` |
| <abbr title="Done">✅</abbr> | Mouse Scroll | `&msc` |

**Composite Behaviors** (authored in builder/config; compiled to devicetree nodes)

| Status                       | Behavior                  |
| ---------------------------- | ------------------------- |
| <abbr title="Done">✅</abbr> | Hold-Tap                  |
| <abbr title="Done">✅</abbr> | Tap Dance                 |
| <abbr title="Done">✅</abbr> | Macros                    |
| <abbr title="Done">✅</abbr> | Mod-Morph                 |
| <abbr title="Done">✅</abbr> | Sensor Rotation (encoder) |

#### Advanced ZMK Features

| Status                          | Feature                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| <abbr title="Done">✅</abbr>    | Bluetooth profile management (via `&bt` bindings)                      |
| <abbr title="Done">✅</abbr>    | Combos (timeout, key positions, layer restrictions) — builder/compiler |
| <abbr title="Done">✅</abbr>    | Conditional Layers (if-layers → then-layer) — builder/compiler         |
| <abbr title="Done">✅</abbr>    | Encoder rotation bindings (CW / CCW per layer) — builder/compiler      |
| <abbr title="Planned">🗓️</abbr> | App-managed BLE secure connection (ECDH)                               |

---

### QMK / VIA / Vial / Keychron (live editor)

#### Core QMK / VIA

| Status                          | Feature                                |
| ------------------------------- | -------------------------------------- |
| <abbr title="Done">✅</abbr>    | Raw HID transport (VIA protocol)       |
| <abbr title="Done">✅</abbr>    | Layout sideloading via `keyboard.json` |
| <abbr title="Done">✅</abbr>    | Standard key / layer assignment        |
| <abbr title="Done">✅</abbr>    | Modifier keys & combinations           |
| <abbr title="Done">✅</abbr>    | Media & system keys                    |
| <abbr title="Done">✅</abbr>    | Layer switching (MO / TG / LT / DF)    |
| <abbr title="Done">✅</abbr>    | One-shot modifiers                     |
| <abbr title="Done">✅</abbr>    | Mouse keys (movement, buttons, wheel)  |
| <abbr title="Planned">🗓️</abbr> | Bootmagic config                       |
| <abbr title="Planned">🗓️</abbr> | Full EEPROM reset (keymap reset done)  |

#### Vial Advanced Features

| Status                          | Feature                                                             |
| ------------------------------- | ------------------------------------------------------------------- |
| <abbr title="Done">✅</abbr>    | Device lock / unlock                                                |
| <abbr title="Done">✅</abbr>    | Tap Dance (onTap / onHold / onDoubleTap / onTapHold / tapping term) |
| <abbr title="Done">✅</abbr>    | Combos (up to 4 keys + output)                                      |
| <abbr title="Done">✅</abbr>    | Key Overrides (remap rules with activation options)                 |
| <abbr title="Done">✅</abbr>    | Macros (tap / down / up / delay / text sequences)                   |
| <abbr title="Done">✅</abbr>    | Encoder behavior per layer (CW / CCW)                               |
| <abbr title="Done">✅</abbr>    | Alt-Repeat-Key                                                      |
| <abbr title="Done">✅</abbr>    | RGB underglow effect + color config                                 |
| <abbr title="Planned">🗓️</abbr> | QMK Settings panel (tapping term, debounce, etc.)                   |
| <abbr title="Planned">🗓️</abbr> | Backlight brightness                                                |
| <abbr title="Planned">🗓️</abbr> | Auto Shift config                                                   |
| <abbr title="Planned">🗓️</abbr> | Caps Word config panel                                              |
| <abbr title="Planned">🗓️</abbr> | One-Shot config panel                                               |

#### Keychron Extensions

| Status                       | Feature                                      |
| ---------------------------- | -------------------------------------------- |
| <abbr title="Done">✅</abbr> | RGB per-key lighting editor                  |
| <abbr title="Done">✅</abbr> | RGB mixed-region control                     |
| <abbr title="Done">✅</abbr> | Wireless settings (LPM, NKRO, factory reset) |
| <abbr title="Done">✅</abbr> | Encoder support                              |
| <abbr title="Done">✅</abbr> | Dynamic debounce / report-rate / snap-click  |

---

### Editor tools

| Status                       | Feature                                       |
| ---------------------------- | --------------------------------------------- |
| <abbr title="Done">✅</abbr> | Heatmap (press-count colouring)               |
| <abbr title="Done">✅</abbr> | Live view (highlight keys as pressed)         |
| <abbr title="Done">✅</abbr> | Key test (hardware matrix, OS-event fallback) |
| <abbr title="Done">✅</abbr> | Per-key RGB painting (Keychron / per-key QMK) |
| <abbr title="Done">✅</abbr> | Typing load stats                             |
| <abbr title="Done">✅</abbr> | Wireless & Advanced settings panels           |
| <abbr title="Done">✅</abbr> | Undo / redo · save / discard pending changes  |

---

### App-Level

| Status                          | Feature                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| <abbr title="Done">✅</abbr>    | Electron shell (Windows / macOS / Linux)                              |
| <abbr title="Done">✅</abbr>    | Firmware adapter abstraction (plug-in per vendor)                     |
| <abbr title="Done">✅</abbr>    | Capability-gated UI (features shown only when firmware supports them) |
| <abbr title="Done">✅</abbr>    | Keymap import / export (Remappr JSON config)                          |
| <abbr title="Planned">🗓️</abbr> | Cloud sync / backup                                                   |
| <abbr title="Planned">🗓️</abbr> | Profile sharing                                                       |

---

### Future firmwares

Remappr aims to be firmware-agnostic. Two extension points make new firmwares
tractable: a **[firmware adapter](https://docs.remappr.com/dev/project-structure)**
for the live surface (probe a device → a capability-gated `KeyboardService`) and a
**[compiler Strategy](https://docs.remappr.com/dev/compilers)** for the export
surface (lower the generalized config to that firmware's project files).

The north star is a **first-party Remappr Firmware** — a native firmware the
manager controls end-to-end, lifting the live-editing ceiling that third-party
protocols impose (combos, macros, tap-dance, encoders and new behaviors become
editable on-device in real time). Early vision; no ship date.

| Status                                                     | Firmware                                               |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| <abbr title="Future — fork goal beyond upstream">🔮</abbr> | **Remappr Firmware** (first-party) — full live control |

No other firmwares are planned right now — but thanks to those two extension
points, new ones can be added if demand appears.
See [Adding a firmware target](https://docs.remappr.com/dev/adding-a-firmware-target).

---

## License

Licensed under the [Apache License 2.0](LICENSE) — see [NOTICE](NOTICE) for
copyright and third-party attributions.

> Remappr originated as a fork of [ZMK Studio](https://github.com/zmkfirmware/zmk-studio)
> (Apache 2.0) and has since been substantially rewritten. Its firmware support
> interoperates with ZMK, QMK, VIA, Vial and Keychron via their public protocols
> and keycode numbering — it does not include or link their source. See
> [NOTICE](NOTICE) for the full attribution list.
