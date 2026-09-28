# Project structure

Remappr is one React UI wrapped in an **Electron** shell, with per-vendor
**firmware adapters** behind a common interface. This page maps the repo so you
know where to change things.

## Top level

```
src/            Application source (see below)
docs/           This documentation site (VitePress)
scripts/        Build / release helper scripts
resources/      Static app resources bundled into the shells
public/         Web build static assets (logo, fonts, favicon)
build/          Electron-builder assets (icons, entitlements)
.github/        CI: ci.yml, main.yml (app→Pages), docs.yml, pr-preview.yml, release
```

Stack: React 19 · Vite 7 · Tailwind 4 · shadcn/ui · Zustand + Immer · Electron 39
· Vitest. Package manager pnpm 10; Node ≥ 20 (`.nvmrc`).

## `src/`

```
src/
  main/        Electron main process: BLE (BlueZ), HID, serial, IPC, lifecycle,
               GitHub artifact proxy, OS secret store
  preload/     Context-isolated bridge — the whitelisted IPC surface
  renderer/    The React app (Vite root) — all UI
  firmware/    Firmware adapters + the generalized config & compilers
  shared/      Cross-process types + logger
```

The **main** process owns native I/O (USB/serial, BLE via BlueZ/D-Bus, raw HID)
and exposes a narrow IPC surface through **preload**; the **renderer** never
touches Node APIs directly.

## `src/firmware/` — adapters, transports, config

```
firmware/
  adapter.ts        FirmwareAdapter interface + Probe / Discovery
  registry.ts       registerAdapter / pickAdapter
  service.ts        the KeyboardService facade the UI talks to
  transport.ts      transport abstraction (serial / HID / BLE)
  codec.ts          per-firmware KeycodeCodec (Strategy)
  catalog/          the shared keycode catalog (one vocabulary)
  config/           the generalized JSON keymap config + compilers  ← see below
  zmk/              ZMK adapter (Studio protocol, BLE/serial)
  qmk/              QMK adapter (raw HID / VIA)
  qmk-vial/         Vial extensions (dynamic entries, macros, unlock)
  via/              VIA channels (RGB matrix, …)
  keychron/         Keychron extensions (per-key RGB, wireless, advanced)
  mock/             simulated device (demo mode) + seed.keymap.json
  kle/              keyboard-layout-editor parser
  hid/              raw HID client
```

### The adapter pattern

Each vendor implements a `FirmwareAdapter` (probe a connected device → produce a
`KeyboardService`). Adapters self-register in `registry.ts`; `pickAdapter`
chooses one for a discovered device. The UI only ever talks to the
**`KeyboardService`** facade and its sub-facades (`encoders`, `dynamic`,
`macros`, `rgb`, `wireless`, `advanced`, `keyTest`, `lock`) — capability-gated, so
a feature's UI appears only when its facade exists. This is why the same editor
serves ZMK, QMK, Vial and Keychron without firmware `if`-chains in components.

### `src/firmware/config/` — the config layer

The generalized, firmware-agnostic keymap config and the per-firmware compilers.
This is the heart of the builder/export path — documented in depth:

- [Architecture](/dev/architecture) — the config module data-flow
- [Compilers](/dev/compilers) — the `KeymapCompiler` Strategy + emitters
- [Adding a firmware target](/dev/adding-a-firmware-target)
- [Config reference](/reference/config/overview) — the data model

## `src/renderer/src/`

```
renderer/src/
  features/
    builder/        the keyboard builder (canvas, inspector, meta form, export)
    keymap/         the keymap editor (keyboard view, layer picker, stage tools)
    connection/     start page, device menu, transports, lock overlay
    firmware/       firmware-gated panels (RGB, wireless, advanced, sideload)
    dynamic/        Vial dynamic entries (tap-dance / combo / key-override / …)
    lighting/       RGB glow engine + KeyLight
    actions/        action/keycode pickers shared across editor & builder
    onboarding/     coachmarks / tours
  stores/           Zustand stores (one per concern — see below)
  layout/           app chrome (Header, …)
  components/        shared UI (modals, shadcn primitives)
  transport/         web-serial / web-ble (browser transports)
  lib/               helpers (e.g. githubBuild REST client)
```

### State — Zustand stores

State is split into small stores under `stores/`, each owning one concern:

- **`configStore`** — the canonical `ConfigKeymap` (source of truth).
- **`builderStore`** — builder canvas/selection/undo state.
- **`keymapStore`**, **`layerSelectionStore`**, **`undoRedoStore`** — editor.
- Device/feature stores: `connectionStore`, `lockStateStore`,
  `rgbSheetStore`, `perKeyPaintStore`, `keyTestStore`, `heatmapStore`,
  `liveViewStore`, `loadStatsStore`, `dynamicCatalogStore`,
  `lightingCatalogStore`, `userSettingsStore`, …

Reading a store + lifting selectors is the perf pattern used on the canvas (see
the canvas-perf notes); keep component reads narrow.

## The Electron shell

|                 | Electron                                         |
| --------------- | ------------------------------------------------ |
| Native I/O      | `src/main/*` (Node: serialport, node-hid, BlueZ) |
| Renderer bridge | `preload/` IPC                                   |
| Build           | `pnpm ebuild`, `build:win/mac/linux`             |

A browser build (web-serial / web-hid transports) runs the same renderer and
firmware adapters — only the transport plumbing differs.

## Where to change things

| Goal                   | Start in                                                  |
| ---------------------- | --------------------------------------------------------- |
| A builder UI tweak     | `features/builder/`                                       |
| An editor UI tweak     | `features/keymap/`, `layout/Header.tsx`                   |
| Keymap config shape    | `firmware/config/types.ts` + `schema.ts`                  |
| Firmware export output | `firmware/config/compilers/`                              |
| A new firmware target  | [Adding a firmware target](/dev/adding-a-firmware-target) |
| Live-device behavior   | the relevant `firmware/<vendor>/` adapter + `service.ts`  |
| Native USB/BLE/HID     | `src/main/` (+ `preload/`)                                |

## Tooling

```sh
pnpm edev          # Electron dev (renderer + main + preload)
pnpm dev           # renderer-only Vite (browser preview)
pnpm typecheck     # tsc (node + web projects)
pnpm lint          # eslint
pnpm test          # vitest
pnpm docs:dev      # these docs
```

See [Contributing](/dev/contributing) for setup and conventions.
