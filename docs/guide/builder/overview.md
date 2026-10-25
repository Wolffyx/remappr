# Builder overview & toolbar

The Builder is a full-screen, canvas-based tool for designing a keyboard from
scratch — its physical layout, electrical matrix, controller, lighting, layers
and key bindings — and exporting it as a buildable firmware project.

Open it from the Start Page with **Create a keyboard** → **Open builder**.

::: info Access during development
While the builder is in alpha/beta it is **free** for everyone (a "{stage} · FREE"
badge shows on the Start Page card). At general availability it becomes a premium
feature that needs an account.
:::

![The builder: toolbar across the top, the Layers / Build from / Identity panel on the left, the default 42-key split on the canvas](/images/builder/overview.webp)

## Starting a board {#starting-a-board}

A new design opens the **New design** dialog: five steps down the left (a row of
step dots when the window is narrow), the current step on the right. **Back**, **Skip** and **Next: …** move between
them; the last step's button is **Open the builder**.

![The Design a keyboard dialog with its five starting points, under the first step of the builder tour](/images/builder/start-dialog.webp)

| Step                    | What you do                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1 What is it**        | Pick a starting point (below), or **Or design a device** for a [mouse, gamepad or flight stick](/guide/builder/device-layout).                   |
| **2 Firmware**          | _"Pick every firmware it should build for."_ The same cards as [Firmware targets](/guide/builder/identity-and-hardware#firmware-targets).        |
| **3 Features**          | [Feature cards](/guide/builder/identity-and-hardware#feature-cards): what the board does. Each sets the right options for every firmware picked. |
| **4 Controller & pins** | The controller and where each row and column is wired — the same [Pins panel](/guide/builder/layout#pins) as in the builder.                     |
| **5 Check**             | _"What each firmware still needs before it builds."_                                                                                             |

The starting points in step 1:

| Option                     | Does                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Start from a preset**    | _"Corne, ortho, 60%, numpad, macropad…"_ — see [Presets](/guide/builder/layout#create-the-geometry). |
| **Import from KLE**        | _"Paste keyboard-layout-editor raw data."_                                                           |
| **Start blank**            | _"Draw a grid or add keys one by one"_ — opens the [empty-board start](#empty-board-start).          |
| **Import config**          | _"Load a remappr .json — file or paste."_ The whole config: layout, layers, bindings, hardware.      |
| **Load from saved builds** | _"Reopen a board saved on this machine"_ — your [library](#keyboard-library).                        |

A preset, KLE layout, config or saved build carries on at step 2. **×** keeps
whatever is on the canvas — on a first visit, a 4×6-per-half split (42 keys) to
try things on. The **Presets**, **Import KLE** and **Make grid** buttons in the
left panel open the same dialogs any time.

### Empty-board start {#empty-board-start}

**Start blank** leaves the canvas showing _"Start a keyboard — Pick one;
everything stays editable."_ with three ways in:

- **From a preset** — the preset dialog.
- **Draw a grid** — **rows** and **cols**, with **split** (two halves with a gap)
  and **thumbs** (three thumb keys under the inner columns of each half). The
  button counts the keys it will draw, e.g. **Draw 54 keys**.
- **Import** — **KLE layout** or **Remappr config**.

The shortcuts that matter are listed underneath. **Start from one key** closes
it and leaves a single key to build up from. It also goes away by itself as soon
as the layout changes.

### The tour

The first time, a seven-step tour walks through the builder: **Welcome**,
**Start your board**, **Place & arrange keys**, **Layers**, **Wire the matrix**,
**Inspect & bind**, **Export & build**. **Skip** ends it; **Replay builder tour**
(**?** in the toolbar) runs it again.

## The layout

```
┌──────────────────────────────────────────────────────────────┐
│  Toolbar                                                       │
├───────────────┬──────────────────────────────┬────────────────┤
│  Left panel   │   Layout variants · tools    │   Inspector     │
│  • Filter     │                              │  Place /        │
│  • Layers     │          Canvas              │  Settings /     │
│  • Build from │      (pan / zoom keys)       │  Wiring         │
│  • Board …    │   status · steps bar         │  — or JSON —    │
└───────────────┴──────────────────────────────┴────────────────┘
```

## Toolbar reference

Left to right: navigation and the board summary (`4×6 per half · 42 keys`) on
the left, the canvas tools in the middle, and the panels, library and hand-offs
on the right. The exact tooltip of each button:

| Button                | Tooltip                                                              | Does                                                                                             |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| ←                     | **Back**                                                             | Leave the builder.                                                                               |
| ▭                     | **Hide panel** / **Show panel**                                      | Collapse/expand the left panel.                                                                  |
| Search field          | **Search the builder**                                               | Opens the [search palette](#search) (`/`).                                                       |
| Snap modes            | **Snap to the ⅛U grid** / **Snap to rows & columns** / **Free form** | Placement mode — see [Snapping](/guide/builder/layout#snapping).                                 |
| 🧲                    | **Snapping on** / **Snapping off**                                   | Toggle snapping while dragging.                                                                  |
| **Keys \| Wiring**    | **View**                                                             | Switch to the [Wiring view](/guide/builder/layout#wire-the-matrix) and back; the choice is kept. |
| ↶                     | **Undo**                                                             | Undo the last edit.                                                                              |
| ↷                     | **Redo**                                                             | Redo.                                                                                            |
| `{ }`                 | **Edit config JSON**                                                 | Swap the inspector for the live JSON editor.                                                     |
| ▤                     | **Keyboard library**                                                 | Open saved boards.                                                                               |
| ?                     | **Replay builder tour**                                              | Re-run the guided coachmark tour.                                                                |
| ⚙                     | **Settings**                                                         | App settings.                                                                                    |
| ⤓                     | **Save to library**                                                  | Save the current board to your [library](#keyboard-library).                                     |
| **Editor →**          | **Editor**                                                           | Hand off to the [keymap editor](/guide/editor) on a demo device.                                 |
| **Export & build 🚀** |                                                                      | Open the [export modal](/guide/builder/export-build-flash).                                      |

The zoom control sits in the canvas's top-right corner, the same one the
[keymap editor](/guide/editor) shows: **Zoom out**, the zoom as a percentage
(`100%` = fitted), **Zoom in** and **Reset view**.

### Steps bar {#steps-bar}

Along the bottom of the board, five steps show how far the design is:
**1 Layout › 2 Wiring › 3 Pins › 4 Firmware › 5 Export**. A ✓ marks a step with
nothing left; otherwise a live count says what is left (**3 clashes**, **10 missing**,
**2 notes**, **1 to fix**), in red when something is wrong.

Click a step to see what is left. Each one has a button that goes to where it
is fixed — **Show keys**, **Show wiring**, **Show pins**, **Show readiness** —
and, when there is one, the one-click fix: **Fix with Auto** for clashing
keys, **Suggest free pins** for rows and columns with no pin. **5 Export** opens
the [export](/guide/builder/export-build-flash) straight away.

| Step         | Counts                                                                       |
| ------------ | ---------------------------------------------------------------------------- |
| **Layout**   | `empty` while a blank board has no layout yet.                               |
| **Wiring**   | Keys sharing a row and column with another key.                              |
| **Pins**     | Row/column pins not set, or not on the controller / used twice.              |
| **Firmware** | The [readiness](/guide/builder/export-build-flash#readiness) of each target. |

### Status bar

Just above the steps:

- `12 selected` — when keys are selected.
- `Drag to marquee · Space/middle-drag to pan · scroll to zoom` — when nothing
  is selected.
- The current snap mode: `snap ⅛U`, `snap rows & columns`, `snap off` or
  `free-form`.

In the Wiring view it becomes the [wiring status](/guide/builder/layout#wiring-status).
The board summary — `4×12 · 48 keys` (rows × cols), or `4×6 per half · 42 keys`
for a split — sits next to the **Builder** title in the toolbar.

### Selection toolbar {#selection-toolbar}

Select keys and a toolbar appears under them, at any zoom:

| Button                                   | Does                                                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Align ▾**                              | Line them up on **Left edges**, **Centres**, **Right edges**, **Top edges**, **Middles** or **Bottom edges**. Two or more keys.                       |
| **Space evenly**                         | Equal gaps along the direction they spread most; the first and last key stay put. Three or more keys.                                                 |
| **Same row**                             | Wire them all to one matrix row.                                                                                                                      |
| **Number columns**                       | Number their matrix columns left to right.                                                                                                            |
| **Mirror to right half** / **left half** | On a split board, copy them to the other half (rotation mirrored; spots already taken are skipped). Otherwise **Flip** turns them over in place. `M`. |
| **Rotate**                               | Turn them 15° about their centre; **Shift**-click turns back. `R` / `Shift + R`.                                                                      |
| **Duplicate**                            | Copy them. `Ctrl/Cmd + D`.                                                                                                                            |

### Search {#search}

- **`/`** or the search field in the toolbar opens _"Search parts, settings,
  actions and keys"_: settings (with on/off switches for firmware options and
  feature cards), builder actions, parts and the keys on the board. Picking a
  setting opens its group and flashes it.
- **Filter settings** at the top of the left panel narrows the settings groups
  to what matches.
- **`Ctrl/Cmd + F`** — **Find on the board**: _"Find on every layer"_ lights
  up the keys whose binding matches, with previous / next match.

### Layout variants

The bar floating at the top of the canvas (**LAYOUT · All · + Variant**) holds
the board's physical-layout variants — alternative key sets on one PCB, such as a
split spacebar vs a 2u one. **+ Variant** adds one; picking a variant dims the keys
that belong to the others; double-click a name to rename it, **×** to delete it;
**All** clears the filter. Tag keys into a variant from the inspector's
[Layout variant](/guide/builder/inspector#layout-variant) field.

## Left panel sections

| Section                                                            | What it holds                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layers**                                                         | The layer list (add / duplicate / delete / rename). See [Layers & bindings](/guide/builder/layers-and-bindings).                                                                                                                                                          |
| **Build from**                                                     | Create geometry: **Presets**, **Import KLE**, **Make grid**, **Add key**. See [Building the layout](/guide/builder/layout).                                                                                                                                               |
| **Board**, **Firmware**, **Lighting**, **Behavior**, **Readiness** | The settings, one group open at a time: name, USB ids, controller, matrix, firmware targets and [per-firmware tabs](/guide/builder/identity-and-hardware#firmware-tabs), lighting, timing and behaviors. See [Identity & hardware](/guide/builder/identity-and-hardware). |

A reminder under the sections notes: _"Geometry & matrix are shared across all
layers."_ — only bindings differ per layer.

## Edit config JSON

**Edit config JSON** (`{ }`) swaps the inspector for the config itself — _"Config
JSON · Schema-checked · autocomplete · live-updates"_:

![The Config JSON panel docked on the right, with the Valid · matches schema · applied live status](/images/builder/json.webp)

- **Editor** — the live [JSON config](/reference/config/overview). Edits apply as
  you type while the JSON is valid (_"Valid · matches schema · applied live"_);
  invalid values are underlined and nothing is applied until they are fixed.
- **Ctrl/⌘+Space** suggests fields and values.
- **All options** — the full reference of every field.
- **↻** (**Re-sync from the board**) reloads the JSON from the board on the
  canvas; **×** closes the panel.

## Keyboard library

**Keyboard library** (▤) lists the boards saved on this machine — _"Saved boards
on this machine"_. **Save current board** (or **Save to library** ⤓ in the
toolbar) adds the one on the canvas; pick a saved board to reopen it.

![The Keyboard library dialog, empty: Save current board](/images/builder/library.webp)

Boards are stored in the browser (or the desktop app's storage) on this machine
only — export the [JSON config](/guide/builder/export-build-flash#the-remappr-json-config)
to keep a copy elsewhere.

## Keyboard shortcuts

| Keys                                    | Action                      |
| --------------------------------------- | --------------------------- |
| `Ctrl/Cmd + Z`                          | Undo                        |
| `Ctrl/Cmd + Shift + Z` · `Ctrl/Cmd + Y` | Redo                        |
| `Ctrl/Cmd + A`                          | Select all keys             |
| `Ctrl/Cmd + D`                          | Duplicate selection         |
| `Backspace` / `Delete`                  | Delete selection            |
| `Esc`                                   | Clear selection             |
| Arrow keys                              | Nudge 0.25U                 |
| `Shift` + arrows                        | Nudge 1U                    |
| `R` / `Shift + R`                       | Rotate selection 15° / back |
| `M`                                     | Mirror selection            |
| `/`                                     | Search the builder          |
| `Ctrl/Cmd + F`                          | Find on the board           |

## How a design flows through Remappr

Everything you do edits one in-memory
**[JSON keymap config](/reference/config/overview)**. From there you can **Edit
JSON** (hand-edit the same config), hand it to the **Editor**, or **Export &
build** a per-firmware project.

## Next

[Build the layout →](/guide/builder/layout)
