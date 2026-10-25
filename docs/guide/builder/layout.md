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

| Field      | Inspector label                 | Meaning                                                                        |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `x`, `y`   | X / Y                           | Position in key units (U).                                                     |
| `w`, `h`   | Width / Height                  | Size in U (default 1).                                                         |
| `r`        | Angle °                         | Rotation.                                                                      |
| `rx`, `ry` | Pivot X / Pivot Y               | Rotation origin.                                                               |
| `matrix`   | Row / Column                    | Electrical position `[row, col]`.                                              |
| `pin`      | Direct GPIO pin                 | Per-key direct GPIO (direct-pin boards).                                       |
| `element`  | Key / Encoder / Slider / Button | Input element type: a knob, a slider or a round button is drawn as what it is. |

The inspector edits all of these — see [Key inspector](/guide/builder/inspector).

## Parts on the board {#parts}

Besides keys, a board can carry **parts**: a **Screen**, an **Analog stick**,
a **D-pad** and a **Trigger**. They sit on the canvas where they really are,
drawn as what they are (the device editor's shapes): click one to select it,
drag it to move it, turn it with its rotate handle, resize it with its grips,
`Delete` to remove it. Its inspector has two tabs — **Place** (name, variant,
X / Y / Width / Height / Rotation) and **Settings**.

New parts come from the **Parts tray** floating at the left of the canvas:
**Key**, **Screen**, **Knob**, **Slider**, **Motor slider**, **Stick**,
**D-pad**, **Trigger** and **Button**. Click one to add it in the middle of the
view, or drag it and let go where it goes. A knob, slider and round button are
still keys — each has a keymap position and a binding — drawn as what they are.
The **Parts** group in the sidebar lists everything on the board that is not a
plain key; the `/` search finds every part too.

A part's pins join the [Pins panel](#pins): a stick's two analog axes, a
D-pad's four directions, a trigger's axis, a screen's pins (below). Parts are
saved in `keyboard.parts`.

### Screens {#screens}

A screen's **Settings** — and the [Screen feature card](/guide/builder/identity-and-hardware#feature-cards)
— ask _"Screen · which one is it?"_ with a tile per common module:

| Tile               | Chip             | Bus | Size    |
| ------------------ | ---------------- | --- | ------- |
| OLED 128×32        | SSD1306          | I²C | 128×32  |
| OLED 128×64        | SSD1306          | I²C | 128×64  |
| OLED 128×64        | SH1106           | I²C | 128×64  |
| nice!view          | Sharp memory LCD | SPI | 160×68  |
| E-paper 80×128     | IL0323           | SPI | 80×128  |
| Colour LCD 240×240 | ST7789           | SPI | 240×240 |

Each tile shows the firmware you picked, crossed out where that firmware has no
driver for its chip. **Other…** sets the bus (**I²C**, **SPI** or **UART**), the
controller chip, the size and (on I²C) the address by hand. **Turned** rotates
the picture; turning the screen part on the board turns the picture with it (to
the nearest quarter turn).

A screen keeps the size its module gives it: no resize grips, and Width /
Height are greyed. Turn on **Use my own size** (Place tab) to size it by hand,
for a bezel or a custom panel.

The bus decides the pins: an I²C screen uses the controller's I²C pins (held
for the bus, nothing else to set), an SPI one needs **CS**, **DC** and **RST**
(an e-paper also **BUSY**, a memory LCD only **CS**) beside the controller's SPI
pins, a UART one **TX** and **RX**.

What each export writes for the screen:

| Firmware | Writes                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ZMK      | The screen's node on the controller's I²C or SPI bus, `chosen zephyr,display`, and `CONFIG_ZMK_DISPLAY=y` (SSD1306, nice!view, IL0323 e-paper).              |
| Remappr  | The same node and `chosen`, plus `REMAPPR_OLED` and the bus driver in `Kconfig.defconfig` (SSD1306, SH1106, nice!view). The OLED service needs the node bus. |
| QMK      | `OLED_ENABLE` with its chip, size, address and SPI pins (SSD1306, SH1106), or Quantum Painter's `st7789_spi` driver for the colour LCD.                      |

Each node copies one from the firmware's own tree (ZMK's corne, kyria,
nice_view and corneish_zen; Remappr's rig). A chip the firmware has no driver
for is left out, and the export and the **Check** step say so. You still draw
on a QMK screen in `keymap.c`.

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
**Suggest free pins** (fill every pin not set yet with one the controller has
free).

### Pins {#pins}

In the Wiring view with nothing selected, the right panel is **Pins ·
{controller}**. It lists every pin the design wires: the matrix rows and
columns (**R0**, **C0**…) and the pins its parts need — a motion sensor's chip
select and motion line (**CS**, **MOT**), each encoder's two phases (**E0A**,
**E0B**), an analog pin per slider key, the LED data pin (**LED**) when the
design has lighting, and a battery sense pin (**BAT**) when it has a battery
and the controller can't measure it itself (a nice!nano and a Xiao BLE can).
A backlight (**BL**) or external-power (**PWR**) pin set up in the firmware
settings shows here too. Two tabs:

- **Board** — a drawing of the controller. Pick a chip, then click a pad to
  wire it there. Each pad shows who uses it.
- **Table** — every pin by name, with a dropdown of the controller's pins.

**Suggest free pins** fills the unset ones by what each is for:

- A part on a bus (the motion sensor on SPI) keeps the controller's own SPI
  pins free for it; they show as **Held for the bus** (on a nice!nano: SCK D15,
  MOSI D16, MISO D14).
- Analog parts and the battery pin get the controller's real analog pins (a
  nice!nano has three: D19, D20, D21 — the "A6–A10" silkscreen names are not
  analog).
- Everything else takes plain pins first, then analog pins, and the NFC pads
  (nice!nano D10, D16) last.

With a battery pin set, **Battery divider** under the panel takes its two
resistors (**To ground** and **Whole path**, in Ω): ZMK writes the battery only
with both, Remappr assumes a 1:2 divider without them. Both write it on nRF
controllers only (ZMK's divider driver reads the nRF ADC).

Pins the controller does not have, used twice, or on a held bus are shown in
red; the hint under the panel lists the pin names the controller takes. On a
split board both halves use the same column pins. The facts come from each
controller's board files and datasheet; a controller remappr has no facts for
still gets pins in header order.

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
