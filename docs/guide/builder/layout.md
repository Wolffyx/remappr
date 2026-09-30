# Building the layout

The **layout** is the set of physical keys — their position, size and rotation —
plus the **matrix** that says how each key is wired electrically. Both feed the
firmware export and both live under `keyboard` in the
[config](/reference/config/keymap-format#keyboard).

## Create the geometry

The left panel's **Build from** section has four entry points. The
[Design a keyboard](/guide/builder/overview#starting-a-board) dialog offers the
same starting points, plus **Import config** and **Load from saved builds**.

| Tool           | Dialog                                                      | What it does                                                         |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| **Presets**    | _"Start from a preset — replaces the current board layout"_ | Pick a known layout (Corne, ortho, 60%, numpad, macropad…).          |
| **Import KLE** | _"Import from KLE — keyboard-layout-editor.com raw data"_   | Paste the **Raw data** from KLE's Download menu → **Import layout**. |
| **Make grid**  | _"Make a grid — Ortholinear rows × columns"_                | Set **Rows** / **Columns** → **Create R×C grid**.                    |
| **Add key**    | —                                                           | Drop a single 1U key onto the canvas.                                |

The first three **replace** the geometry (layer names kept, bindings reset to
pass-through); **Add key** is additive.

### Presets

![Start from a preset: Corne / split 42, Ortho 4×12, 60% ANSI, Numpad, Macropad 3×3, Blank canvas](/images/builder/presets.webp)

_"Start from a preset — Replaces the current board layout"_:

| Preset               | What you get          |
| -------------------- | --------------------- |
| **Corne / split 42** | 3×6 + 3 thumbs, split |
| **Ortho 4×12**       | Planck-style grid     |
| **60% ANSI**         | Compact staggered     |
| **Numpad**           | 17-key number pad     |
| **Macropad 3×3**     | 9-key macro grid      |
| **Blank canvas**     | Start from nothing    |

### Import from KLE

![Import from KLE: a box for the Raw data, and Import layout](/images/builder/import-kle.webp)

On [keyboard-layout-editor.com](http://www.keyboard-layout-editor.com), open
**Raw data**, copy everything, paste it into the box (_"Paste the 'Raw data' from
the KLE Download menu…"_) and press **Import layout**.

### Make a grid

![Make a grid: Rows and Columns, and Create 4×12 grid](/images/builder/make-grid.webp)

_"Make a grid — Ortholinear rows × columns"_: set **Rows** and **Columns**, then
**Create R×C grid**. _"Creates R×C keys in a R×C grid. Resets bindings to
pass-thru; layer names are kept."_

::: tip KLE imports
_"Imports key positions & sizes only — legends and matrix wiring are assigned in
the builder."_ So after a KLE import, wire the matrix and assign bindings here.
:::

## Position keys on the canvas

- **Drag** a key to move it; selected keys move together.
- **Marquee** — drag on empty canvas to box-select; `Cmd/Ctrl + A` selects all.
- **Arrow keys** nudge 0.25U (hold **Shift** for 1U).
- `Cmd/Ctrl + D` duplicates; `Delete` / `Backspace` removes.
- **Undo/Redo** covers every geometry edit.

### Snapping

The toolbar **snap mode** switches **Snap to grid** ⟷ **Free form**; the snapping
toggle enables ⅛U snapping while dragging/resizing (status bar shows `snap ⅛U` /
`snap off` / `free-form`).

### What a key looks like in the config

Each key is a [`CanonGeometry`](/reference/config/keymap-format#keyboard). A plain
1U key is just its position — defaulted `w`/`h`/`r` are omitted:

```json
{ "x": 3, "y": 1 }
```

A wider, rotated, matrix-wired thumb key carries the extra fields:

```json
{
    "x": 3.5,
    "y": 3.2,
    "w": 1.5,
    "r": 15,
    "rx": 3.5,
    "ry": 3.2,
    "matrix": [3, 5]
}
```

| Field      | Inspector label        | Meaning                                  |
| ---------- | ---------------------- | ---------------------------------------- |
| `x`, `y`   | X / Y                  | Position in key units (U).               |
| `w`, `h`   | Width / Height         | Size in U (default 1).                   |
| `r`        | Angle °                | Rotation.                                |
| `rx`, `ry` | Pivot X / Pivot Y      | Rotation origin.                         |
| `matrix`   | Row / Column           | Electrical position `[row, col]`.        |
| `pin`      | Direct GPIO pin        | Per-key direct GPIO (direct-pin boards). |
| `element`  | Key / Encoder / Slider | Input element type.                      |

The inspector edits all of these — see [Key inspector](/guide/builder/inspector).

## Wire the matrix

Firmware needs the **electrical row and column** of each key. Two ways to set it:

1. **Matrix-wiring overlay** (toolbar **Matrix wiring view**) — draws each row
   and column as a line through its keys, labels every key with its `row.col`,
   and puts an editable **pin chip** at the end of each line (_"Click to set the
   GPIO pin"_); add rows/cols with the **+** buttons (**Add a matrix row** /
   **Add a matrix column**).

    ![The matrix wiring view: row lines with GP pin chips on the left, column chips along the top, row.col under each key](/images/builder/matrix-wiring.webp)

2. **Per key**, in the inspector's **Matrix wiring · row / column** section.

The Identity panel's **Matrix** section sets the dimensions and has an **Auto**
button — _"Auto assigns each key's row/column from its position"_:

```json
"keyboard": {
  "matrix": { "rows": 4, "cols": 12, "diodeDirection": "col2row", "mode": "matrix" },
  "pins":   { "rows": ["GP4","GP5","GP6","GP7"], "cols": ["GP8","GP9","…"] }
}
```

- When a key's `matrix` is set, it is **authoritative**.
- When absent, the compiler **derives** it from physical position.

::: warning Matrix vs geometry
Physical position is not electrical wiring. For a board you intend to flash, set
the real `[row, col]` per key (or supply a [kscan + transform](/reference/config/hardware))
and re-check the generated map before flashing.
:::

## Next

[Key inspector →](/guide/builder/inspector)
