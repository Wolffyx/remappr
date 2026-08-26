# App settings

The **Settings** dialog (⚙ in the header, or **App settings** in the device menu)
— _"Appearance, keycaps, workspace & device"_ — has five sections down the left.

::: info 📷 Screenshot slot — `docs/public/images/app/settings.png`
The Settings dialog with its section rail: General · Keycaps · Workspace ·
Communication · About.
:::

## General

Appearance of the app itself.

- **Theme** — the colour theme.
- **Dark Mode** — _"Light, dark, or follow the system"_.
- **Key Header** — show the small header strip on each keycap.
- **Colour-coding** — _"Tint keys by their function group"_. Off gives every cap
  the neutral face.

## Keycaps

The **Keycap style** used to draw the board: **Flat**, **Sculpted**, **Mono** or
**Glass** (_"translucent, glowing edge"_). Live previews sit above the picker,
including a hold-tap cap so you can see how the two legends stack.

## Workspace

Which panels the editor opens with — **Workbench**, **Inspector** and
**Command** layouts.

## Communication

How Remappr talks to devices.

- **Firmware family** — picks whose settings the section below shows.
  _"Connection itself still auto-detects."_ The chips under the picker list the
  adapters registered for that family.
- **Auto-save** — _"Save every change to the keyboard automatically."_ QMK / VIA /
  Keychron write each edit immediately; ZMK commits about a second after your
  last edit. With it off, edits wait for **Save**. The header Save button pulses
  while auto-save is on. Default: off.
- **Auto-restore profile** — keep a backup of each device's layout and, when a
  device reconnects wiped or reset, restore it without asking. With it off,
  Remappr prompts first. Supported on ZMK today — see
  [Backup & restore](/guide/app/connecting#backup-restore).

Then a **_(family)_ settings** block with whatever that family exposes — for
example **Auto-load layout from registry**: look the board up in an online layout
registry on connect, instead of uploading a definition by hand with the
toolbar's load button. Families with nothing of their own say so.

## About

App version, licence and project links.

## See also

- [Connecting a device](/guide/app/connecting)
- [Advanced features](/guide/app/advanced)
