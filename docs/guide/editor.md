# The keymap editor

The keymap editor is where you assign bindings against a **device** — a real
connected keyboard, or a simulated one. It is the surface you land on after
[connecting hardware](/guide/app/connecting), and where the builder hands off
when you click **Editor**.

::: info 📷 Screenshot slot — `docs/public/images/editor/editor.png`
The editor: the **LAYERS** sidebar, the keyboard in the centre, the header
toolbar, and the binding inspector on the right.
:::

## The surface

```
┌──────────────────────────────────────────────────────────────┐
│ Header: Remappr · [Builder] │ Heatmap Live KeyTest Stats │ …   │
│         … Flash · Macros · Wireless · RGB · ⚙ │ ↶ ↷ 🗑 Save     │
├──────────┬───────────────────────────────────┬────────────────┤
│ LAYERS   │            keyboard               │  Inspector      │
│ • L0     │      (click a key to edit)        │  "Select a key  │
│ • L1     │                                   │   to edit its   │
│ • L2     │                                   │   action."      │
└──────────┴───────────────────────────────────┴────────────────┘
```

## Header toolbar

The brand button and the **Builder** hand-off sit on the left; the tools sit on
the right in three clusters — **view**, **config**, **history** — separated by
thin rules. Many buttons are **capability-gated**: hidden or disabled unless the
connected firmware supports them.

**View tools**

| Button | Tooltip               | Does                                            |
| ------ | --------------------- | ----------------------------------------------- |
| 🔥     | **Heatmap**           | Toggle a key-press heatmap.                     |
| ⚡     | **Live view**         | Highlight keys as you press them.               |
| ▥      | **Key test**          | Hardware matrix test mode _(gated: `keyTest`)_. |
| 📊     | **Typing load stats** | Open the load-stats modal.                      |

**Config tools**

| Button | Tooltip                    | Does                                                                                                                                                                                                                           |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⤓      | **Flash & export config**  | Open the [export modal](/guide/app/export-flash).                                                                                                                                                                              |
| ⇄      | **Dynamic Entries**        | Open the Advanced sheet at Tap Dance _(gated: `dynamic`)_.                                                                                                                                                                     |
| ✦      | **Macros**                 | Open the Advanced sheet at Macros _(gated: `macros`)_.                                                                                                                                                                         |
| …      | _capability-gated dialogs_ | Wireless · Cluster · Unicode input · Advanced Mode · Timing & Defaults · Behaviors · Conditional Layers · Autocorrect · Node & Cluster · Link Profile — see [Advanced features](/guide/app/advanced#capability-gated-dialogs). |
| 💡     | **RGB lighting**           | Open the [RGB sheet](/guide/app/rgb-lighting). Disabled when the firmware drives lighting at compile time only.                                                                                                                |
| ⇧      | _load a definition_        | One button per source the connected adapter accepts (e.g. a VIA/Vial layout JSON, a ZMK combo file).                                                                                                                           |
| ⚙      | **Settings**               | [App settings](/guide/app/settings).                                                                                                                                                                                           |
|        | **GitHub Repository**      | Open the source repo.                                                                                                                                                                                                          |
|        | **Discord Community**      | Open the Discord invite.                                                                                                                                                                                                       |
| 📖     | **Documentation**          | Open these docs.                                                                                                                                                                                                               |
| ♥      | **Support this project**   | Sponsor links — see [Support this project](/guide/app/connecting#support-this-project).                                                                                                                                        |

**History tools**

| Button   | Tooltip                     | Does                                                                                                                                   |
| -------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ↶ ↷      | **Undo** / **Redo**         | History.                                                                                                                               |
| 🗑       | **Discard changes**         | Revert all pending changes.                                                                                                            |
| **Save** | **Save keymap to keyboard** | Commit changes to the device. With [Auto-save](/guide/app/settings#communication) on it becomes a pulsing auto-save indicator instead. |

See [Advanced features](/guide/app/advanced) for the dialogs and the Advanced
sheet (Macros, Tap Dance, Combos, Key Overrides, Wireless, Advanced Mode).

## Layers

The **LAYERS** sidebar lists layers with an accent dot and an `L0`/`L1` badge.

- **Click** to select; the keyboard shows that layer.
- **+** (**Add Layer**) appends a layer.
- The per-layer **⋮** menu: **Rename** (opens the _"New Layer Name"_ dialog),
  **Duplicate**, **Delete** (disabled when it is the only layer).
- **Drag** the grip handle (_"Drag to reorder"_) to reorder layers.

## Editing a binding

Click a key → the **Inspector** shows the key (a tinted cap preview + its
category and layer) with the binding picker. Closing the picker keeps the key
selected (a floating card with an **Edit** button stays); **Esc** clears the
selection entirely.

- **Empty state:** _"Select a key to edit its action."_
- **Encoders:** the inspector reads/writes CW and CCW separately
  (_"Encoder {slot} — CW/CCW"_).
- **Tap-dance:** when the device supports dynamic entries, an _"Edit tap-dance
  #{n}…"_ button opens the tap-dance editor.

Every change writes to the device immediately and is **undoable**; nothing is
permanent until you **Save**.

## Heatmap, Live view & Key test

These overlay the keyboard:

- **Heatmap** — colours keys by press count, with a _Less → More_ legend and a
  **Reset press counts** button; _"View load stats"_ opens the stats modal.
- **Live view** — lights keys as you press them.
- **Key test** — _"Press every key"_ with a `{seen} / {total}` counter and a
  **Reset key test** button. The status line reads **Hardware matrix** (reading
  the switch matrix over the wire) or **OS events** (fallback via OS key events —
  focus-dependent, misses non-emitting keys).

## Editor vs builder

|        | Builder                                      | Editor                                      |
| ------ | -------------------------------------------- | ------------------------------------------- |
| Target | A design (no hardware needed)                | A device (real or simulated)                |
| Edits  | Layout, matrix, controller, layers, bindings | Bindings, device settings, per-key RGB      |
| Output | Exported firmware project                    | Live changes on the device (Save to commit) |

Both read and write the same [JSON keymap config](/reference/config/overview).

## Next

- [Connecting a device](/guide/app/connecting)
- [RGB & lighting](/guide/app/rgb-lighting)
- [Advanced features](/guide/app/advanced)
