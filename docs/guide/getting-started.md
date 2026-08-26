# What is Remappr?

Remappr is a **universal device manager** — one app to connect, remap, light up
and build your devices across firmwares. It supports **ZMK, QMK, VIA, Vial and
Keychron** today, and is built to add [more firmwares](/guide/roadmap#future-firmwares)
over time. The same React UI ships as a desktop app (Electron) and runs in the
browser at [remappr.com](https://remappr.com).

It does two things:

1. **Edit a keymap on a connected device** — connect over USB/serial, BLE or
   raw HID and remap keys, switch layers, manage Bluetooth profiles, and (on
   supported boards) paint per-key RGB — live, with no reflash. Remappr can
   reconnect to a device automatically on launch and keeps a
   [backup of its layout](/guide/app/connecting#backup-restore) to put back if it
   ever comes back wiped.
2. **Build a keyboard from scratch** — design the physical layout, wire the
   matrix, choose a controller and firmware targets, then export a ready-to-build
   firmware project.

Both flows share one **[JSON keymap config](/reference/config/overview)** — a
generalized, firmware-agnostic document that the live editor reads from, your
edits write back into, and the exporter compiles per firmware.

## Two ways to start

When you open Remappr you land on the **Start Page**, which offers two paths.

### Connect a device

If you have a ZMK Studio-enabled, VIA/Vial or Keychron board, plug it in (or pair
over Bluetooth) and pick it from the connection list. Remappr detects the
firmware family and only shows the features that firmware actually supports
(capability-gated UI). From there you are in the [keymap editor](/guide/editor).

- **ZMK** — USB/serial (CDC-ACM) or BLE. The board must have ZMK Studio enabled.
- **QMK / VIA / Vial** — raw HID via the VIA protocol.
- **Keychron** — VIA/QMK + a BLE radio, with the per-key RGB and wireless panels.

### Create a keyboard

Click **Create a keyboard** to open the **[Builder](/guide/builder/overview)** —
the full-screen design tool. You do not need any hardware connected; you can
design a board, write its keymap, and export a buildable firmware project
entirely offline.

::: tip Demo mode
No keyboard? Choose **Try Demo Mode** on the Start Page to explore the editor
against a simulated 36-key Corne. It is the same config-driven flow as a real
device — a good way to learn the editor before you connect hardware.
:::

## Where to go next

| You want to…                        | Read                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| Install the desktop app             | [Installation](/guide/installation)                        |
| Change how the app talks to devices | [App settings](/guide/app/settings)                        |
| Design a board from scratch         | [Builder overview](/guide/builder/overview)                |
| Lay out keys / wire the matrix      | [Building the layout](/guide/builder/layout)               |
| Set up layers and key bindings      | [Layers & bindings](/guide/builder/layers-and-bindings)    |
| Turn a design into firmware         | [Export, build & flash](/guide/builder/export-build-flash) |
| Understand or hand-write the config | [Config reference](/reference/config/overview)             |
| See what's built vs planned         | [Roadmap](/guide/roadmap)                                  |
| Extend the compilers                | [Developer docs](/dev/project-structure)                   |
