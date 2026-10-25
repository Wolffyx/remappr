# Building the layout

The **layout** is the set of physical keys — their position, size and rotation —
plus the **matrix** that says how each key is wired electrically. Both feed the
firmware export and both live under `keyboard` in the
[config](/reference/config/keymap-format#keyboard).

## Create the geometry

The left panel's **Build from** section has four entry points. The
[New design](/guide/builder/overview#starting-a-board) dialog offers the same
starting points, plus **Import config** and **Load from saved builds**; **Start
blank** there opens the [empty-board start](/guide/builder/overview#empty-board-start),
which can also draw a split grid with thumb keys.

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

- **Select** keys for the [selection toolbar](/guide/builder/overview#selection-toolbar):
  align, space evenly, same row, number columns, mirror, rotate, duplicate.

### Snapping {#snapping}

Three placement modes sit in the toolbar, with the magnet turning snapping on
and off:

| Mode                       | While you drag                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Snap to the ⅛U grid**    | Keys land on ⅛U steps.                                                                                                                                                            |
| **Snap to rows & columns** | Keys line up with their neighbours' rows and columns; guide lines show what they snapped to. **Keep column stagger when snapping** (inspector) keeps a staggered column's offset. |
| **Free form**              | No snapping.                                                                                                                                                                      |

The status bar shows the mode: `snap ⅛U`, `snap rows & columns`, `snap off` or
`free-form`.

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

## Wire the matrix {#wire-the-matrix}

Firmware needs the **electrical row and column** of each key. Switch the
toolbar's **Keys | Wiring** to **Wiring**: each row and column is drawn as a
line through its keys, every key shows its `row·col`, and each line ends in a
pin chip (**Set pin** until one is set). **+** adds a row or column. The view
stays on until you switch back, also the next time the builder opens.

![The matrix wiring view: row lines with GP pin chips on the left, column chips along the top, row.col under each key](/images/builder/matrix-wiring.webp)

### Wiring tools

A bar at the top of the board:

| Tool         | Does                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Auto**     | Rows and columns follow where the keys sit. Moving a key rewires it; keys you keep by hand stay put.                          |
| **By hand**  | Every key keeps its row and column wherever it moves.                                                                         |
| **Renumber** | _"Number every key again from where it sits."_                                                                                |
| **Paint**    | Pick **Rows** or **Columns** and a line, then sweep across keys to put them on it. **+** adds a line; **Esc** or **×** stops. |

Auto works out rows and columns from key centres (rotation included), lets a
staggered column follow its keys, and never gives two keys the same slot.

### Keep, clash and let follow

With one key selected, the inspector's **Wiring** tab has **Keep R2 · C5 when
moved**: the key keeps that row and column wherever it goes, and a lock shows on
its cap. **Let it follow its position** hands it back to Auto.

Two keys on the same row and column **clash**: both get a red outline and the
inspector says _"R2 · C5 is used twice"_. Move one, or keep one by hand and let
Auto place the other.

### Wiring status {#wiring-status}

In the Wiring view, the strip above the [steps bar](/guide/builder/overview#steps-bar)
counts what is **wired**, how many keys **clash**, and which pins are **missing**
or **wrong**, with **Fix with Auto** (re-place every key in a clash) and
**Suggest free pins** (fill empty rows and columns with pins the controller has
free).

### Pins {#pins}

In the Wiring view with nothing selected, the right panel is **Pins ·
{controller}** with two tabs:

- **Board** — a drawing of the controller. Pick a row or column chip, then
  click a pad to wire it there.
- **Table** — every row and column with its pin, typed in.

Pins the controller does not have, or that are used twice, are shown in red;
the hint under the panel lists the pin names the controller takes. On a split
board both halves use the same column pins.

### Matrix settings and the config

The **Board** group's **Matrix** section sets the diode direction and scan mode
and has an **Auto** button — _"Auto assigns each key's row/column from its
position"_:

```json
"keyboard": {
  "matrix": { "rows": 4, "cols": 12, "diodeDirection": "col2row", "mode": "matrix" },
  "pins":   { "rows": ["GP4","GP5","GP6","GP7"], "cols": ["GP8","GP9","…"] }
}
```

- A key's `matrix` is set when it is kept by hand (or wired **By hand**); it is
  **authoritative**.
- When absent, the compiler **derives** it from physical position, the same way
  Auto does.

::: warning Matrix vs geometry
Physical position is not electrical wiring. For a board you intend to flash, set
the real `[row, col]` per key (or supply a [kscan + transform](/reference/config/hardware))
and re-check the generated map before flashing.
:::

## Next

[Key inspector →](/guide/builder/inspector)
