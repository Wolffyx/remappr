# The keymap editor

The keymap editor is where you assign bindings against a **device** — a real
connected keyboard, or the simulated one from
[Try Demo Mode](/guide/app/connecting#try-demo-mode). It is the surface you land
on after [connecting hardware](/guide/app/connecting), and where the builder
hands off when you click **Editor**.

![The editor on the demo Corne: the sidebar on the left, the board in the middle, the header toolbar on top](/images/editor/editor.webp)

## The screen

- **Sidebar** (left) — **LAYOUTS** (the physical layouts the board offers),
  **LAYERS**, the **KEY TYPES** colour legend and, at the bottom, the device
  card with its [device menu](/guide/app/connecting#the-device-menu). The
  **⊟** button at the top-left of the header folds the sidebar away.
- **Board** (middle) — the keyboard itself. A pill in the top-left names the
  layer on show (**base** · layer) next to a **LIVE** badge when the board is
  connected; the zoom controls sit top-right (**−**, the zoom level, **+**, and
  fit-to-view).
- **Header** (top) — the toolbar, described [below](#header-toolbar).
- **Binding editor** — opens when you click a key; where it opens depends on
  the [workspace](/guide/app/editing-bindings#workspaces).

Pan the board with a drag, zoom with the mouse wheel or the zoom controls.

### First-run tour

The first time the editor opens, a four-step tour points out the board, the
layers, the tools and the workspaces. **Skip** ends it; it does not come back.

![The first tour step, "Your keyboard", over the board](/images/editor/tour.webp)

## Keys on the board

Each keycap shows what it does:

- the **header** — the action type (_Key Press_, _Mod-Tap_, _Layer-Tap_…); change
  what it shows under [Settings → General → Key Header](/guide/app/settings#general);
- the **legend** — the key it sends, or an icon for media, Bluetooth and
  lighting actions;
- for hold-taps, a second legend under a rule — the **hold** side (a modifier or
  a layer name);
- a **tint** by function group — modifiers, layers, navigation, editing,
  numbers, media — matching the **KEY TYPES** legend. Turn it down or off with
  [Colour-coding](/guide/app/settings#general).

Rotary encoders sit on the board as a knob cap. See
[Encoders](/guide/app/editing-bindings#encoders).

## Header toolbar

The brand button (back to the Start Page) and the **Builder** hand-off sit on the
left, the project links in the middle, and the tools on the right in three
clusters — **view**, **config**, **history** — separated by thin rules. Many
buttons are **capability-gated**: they only appear when the connected firmware
supports them.

**Project links** (centre)

| Button | Tooltip                  | Does                                                                                    |
| ------ | ------------------------ | --------------------------------------------------------------------------------------- |
|        | **GitHub Repository**    | Open the source repo.                                                                   |
|        | **Discord Community**    | Open the Discord invite.                                                                |
| 📖     | **Documentation**        | Open these docs.                                                                        |
| ♥      | **Support this project** | Sponsor links — see [Support this project](/guide/app/connecting#support-this-project). |

**View tools**

| Button | Tooltip         | Does                                           |
| ------ | --------------- | ---------------------------------------------- |
| 🔥     | **Heatmap**     | Colour keys by how often they are pressed.     |
| ⚡     | **Live view**   | Light keys as you press them.                  |
| ▥      | **Key test**    | Check every switch works _(gated: `keyTest`)_. |
| 📊     | **Typing load** | Hand balance and per-finger load.              |

All four are covered in
[Heatmap, key test & typing load](/guide/app/insights).

**Config tools**

| Button | Tooltip                    | Does                                                                                                                                                                                                                           |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⤓      | **Flash & export config**  | Open the [export modal](/guide/app/export-flash).                                                                                                                                                                              |
| ⇄      | **Dynamic Entries**        | Open the [Advanced sheet](/guide/app/advanced#the-advanced-sheet) at Tap Dance _(gated: `dynamic`)_.                                                                                                                           |
| ✦      | **Macros**                 | Open the Advanced sheet at Macros _(gated: `macros`)_.                                                                                                                                                                         |
| …      | _capability-gated dialogs_ | Wireless · Cluster · Unicode input · Advanced Mode · Timing & Defaults · Behaviors · Conditional Layers · Autocorrect · Node & Cluster · Link Profile — see [Advanced features](/guide/app/advanced#capability-gated-dialogs). |
| 💡     | **RGB lighting**           | Open the [RGB sheet](/guide/app/rgb-lighting). Disabled when the firmware drives lighting at compile time only.                                                                                                                |
| ⇧      | _load a definition_        | One button per source the connected adapter accepts (e.g. a VIA/Vial layout JSON, a ZMK combo file).                                                                                                                           |
| ⚙      | **Settings**               | [App settings](/guide/app/settings).                                                                                                                                                                                           |

**History tools**

| Button   | Tooltip                     | Does                                                                                                                                                                                                     |
| -------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ↶ ↷      | **Undo** / **Redo**         | Step through your edits.                                                                                                                                                                                 |
| 🗑       | **Discard changes**         | Revert all pending changes.                                                                                                                                                                              |
| **Save** | **Save keymap to keyboard** | Commit changes to the device. With [Auto-save](/guide/app/settings#communication) on it becomes a pulsing auto-save indicator instead. Not shown for firmwares that save on their own, nor in demo mode. |

## Layers

The **LAYERS** sidebar lists layers with a colour dot and an `L0`/`L1` badge.

- **Click** a layer to show it on the board; **hover** one to peek at it without
  switching.
- **+** (**Add Layer**) appends a layer.
- **Drag** the grip handle (_"Drag to reorder"_) to reorder layers.
- The **⋮** menu on each layer:

![The layer menu: Rename, Duplicate, Delete](/images/editor/layer-menu.webp)

- **Rename** opens the _"New Layer Name"_ dialog.
- **Duplicate** copies the layer with all its bindings.
- **Delete** removes it (disabled when it is the only layer).

## Editor vs builder

|        | Builder                                      | Editor                                      |
| ------ | -------------------------------------------- | ------------------------------------------- |
| Target | A design (no hardware needed)                | A device (real or simulated)                |
| Edits  | Layout, matrix, controller, layers, bindings | Bindings, device settings, per-key RGB      |
| Output | Exported firmware project                    | Live changes on the device (Save to commit) |

Both read and write the same [JSON keymap config](/reference/config/overview).

## Next

- [Editing bindings](/guide/app/editing-bindings)
- [Heatmap, key test & typing load](/guide/app/insights)
- [RGB & lighting](/guide/app/rgb-lighting)
- [Advanced features](/guide/app/advanced)
