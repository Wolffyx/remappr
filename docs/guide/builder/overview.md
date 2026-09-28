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

## Starting a board

When the builder opens with no board loaded, it asks where to start —
_"Design a keyboard — Pick a starting point — or close to keep the current
board"_:

![The Design a keyboard dialog with its five starting points, under the first step of the builder tour](/images/builder/start-dialog.webp)

| Option                     | Does                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Start from a preset**    | _"Corne, ortho, 60%, numpad, macropad…"_ — see [Presets](/guide/builder/layout#create-the-geometry). |
| **Import from KLE**        | _"Paste keyboard-layout-editor raw data."_                                                           |
| **Start blank**            | _"One key — build up from nothing."_                                                                 |
| **Import config**          | _"Load a remappr .json — file or paste."_ The whole config: layout, layers, bindings, hardware.      |
| **Load from saved builds** | _"Reopen a board saved on this machine"_ — your [library](#keyboard-library).                        |

**×** keeps whatever is on the canvas — on a first visit, a 4×6-per-half split
(42 keys) to try things on. The **Presets**, **Import KLE** and **Make grid**
buttons in the left panel open the same dialogs any time.

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
│  Left panel   │                              │   Inspector     │
│  • Layers     │          Canvas              │  selected key   │
│  • Build from │      (pan / zoom keys)       │  properties     │
│  • Identity   │                              │  — or JSON —    │
├───────────────┴──────────────────────────────┴────────────────┤
│  Status bar   "12 selected"  ·  "snap ⅛U"                        │
└──────────────────────────────────────────────────────────────┘
```

## Toolbar reference

Left to right: navigation and the board summary (`4×6 per half · 42 keys`) on
the left, the canvas tools in the middle, and the panels, library and hand-offs
on the right. The exact tooltip of each button:

| Button                | Tooltip                            | Does                                                             |
| --------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| ←                     | **Back**                           | Leave the builder.                                               |
| ▭                     | **Hide panel** / **Show panel**    | Collapse/expand the left panel.                                  |
| ▦ ✥                   | **Snap to grid** / **Free form**   | Switch placement mode (two segmented buttons).                   |
| ⅛                     | **Snapping on** / **Snapping off** | Toggle ⅛U snapping while dragging.                               |
| ⊞                     | **Matrix wiring view**             | Overlay row/column wiring on the keys.                           |
| ↶                     | **Undo**                           | Undo the last edit.                                              |
| ↷                     | **Redo**                           | Redo.                                                            |
| `{ }`                 | **Edit config JSON**               | Swap the inspector for the live JSON editor.                     |
| ▤                     | **Keyboard library**               | Open saved boards.                                               |
| ?                     | **Replay builder tour**            | Re-run the guided coachmark tour.                                |
| ⚙                     | **Settings**                       | App settings.                                                    |
| ⤓                     | **Save to library**                | Save the current board to your [library](#keyboard-library).     |
| **Editor →**          | **Editor**                         | Hand off to the [keymap editor](/guide/editor) on a demo device. |
| **Export & build 🚀** |                                    | Open the [export modal](/guide/builder/export-build-flash).      |

The zoom cluster (**Zoom out** / **Reset view** / **Zoom in** / **Fit**) shows
the current zoom as a percentage (e.g. `100%`).

### Status bar

The bottom bar shows context:

- `12 selected` — when keys are selected.
- `Drag to marquee · Space/middle-drag to pan · scroll to zoom` — when nothing
  is selected.
- The current snap mode: `snap ⅛U`, `snap off`, or `free-form`.
  The board summary — `4×12 · 48 keys` (rows × cols), or `4×6 per half · 42 keys`
  for a split — sits next to the **Builder** title in the toolbar.

### Layout variants

The bar floating at the top of the canvas (**LAYOUT · All · + Variant**) holds
the board's physical-layout variants — alternative key sets on one PCB, such as a
split spacebar vs a 2u one. **+ Variant** adds one; picking a variant dims the keys
that belong to the others; double-click a name to rename it, **×** to delete it;
**All** clears the filter. Tag keys into a variant from the inspector's
[Layout variant](/guide/builder/inspector#layout-variant) field.

## Left panel sections

| Section        | What it holds                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layers**     | The layer list (add / duplicate / delete / rename). See [Layers & bindings](/guide/builder/layers-and-bindings).                                                             |
| **Build from** | Create geometry: **Presets**, **Import KLE**, **Make grid**, **Add key**. See [Building the layout](/guide/builder/layout).                                                  |
| **Identity**   | The keyboard metadata form: name, USB ids, firmware targets, controller, matrix, lighting, firmware config. See [Identity & hardware](/guide/builder/identity-and-hardware). |

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

| Keys                                    | Action              |
| --------------------------------------- | ------------------- |
| `Ctrl/Cmd + Z`                          | Undo                |
| `Ctrl/Cmd + Shift + Z` · `Ctrl/Cmd + Y` | Redo                |
| `Ctrl/Cmd + A`                          | Select all keys     |
| `Ctrl/Cmd + D`                          | Duplicate selection |
| `Backspace` / `Delete`                  | Delete selection    |
| `Esc`                                   | Clear selection     |
| Arrow keys                              | Nudge 0.25U         |
| `Shift` + arrows                        | Nudge 1U            |

## How a design flows through Remappr

Everything you do edits one in-memory
**[JSON keymap config](/reference/config/overview)**. From there you can **Edit
JSON** (hand-edit the same config), hand it to the **Editor**, or **Export &
build** a per-firmware project.

## Next

[Build the layout →](/guide/builder/layout)
