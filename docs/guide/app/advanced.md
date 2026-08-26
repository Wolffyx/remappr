# Advanced features

On a connected device, Remappr exposes the firmware's advanced behaviors and
hardware settings — each **capability-gated**, so a panel only appears when the
board actually supports it.

::: info 📷 Screenshot slot — `docs/public/images/editor/advanced-sheet.png`
The Advanced sheet with its tabs (Tap Dance · Combo · Key Override · Alt Repeat ·
Macros).
:::

## The Advanced sheet

Opened from the header (**Dynamic Entries** ⇄ or **Macros** ✦). Tabs appear only
when the device advertises that capability:

| Tab              | Shown when             | Edits                                                   |
| ---------------- | ---------------------- | ------------------------------------------------------- |
| **Tap Dance**    | tap-dance count > 0    | Multi-tap behaviors (tap / hold actions, tapping term). |
| **Combo**        | combo count > 0        | Key chords → output.                                    |
| **Key Override** | key-override count > 0 | Remap rules with activation options.                    |
| **Alt Repeat**   | supported              | Alternate-repeat-key.                                   |
| **Macros**       | macro count > 0        | Tap / down / up / delay / text sequences.               |

These map to the same concepts as the config's
[`tapDances`](/reference/config/keymap-format#tapdances),
[`macros`](/reference/config/keymap-format#macros) and
[`combos`](/reference/config/keymap-format#combos) — here you edit them live on
the device (mostly VIA/Vial/Keychron).

## Capability-gated dialogs

Right of the Macros button, the header renders one icon per dialog the connected
firmware advertises. A button that is not there means the device never reported
that capability — nothing is hidden behind a setting. In toolbar order:

| Icon | Dialog                 | Opens                                                                      |
| ---- | ---------------------- | -------------------------------------------------------------------------- |
| 📶   | **Wireless**           | Power, NKRO & connection — see [below](#wireless-settings).                |
| 🕸   | **Cluster**            | Cluster diagnostics for multi-node boards.                                 |
| 🌐   | **Unicode input**      | The host unicode input method — see [below](#unicode-input).               |
| ⏱    | **Advanced Mode**      | Debounce, report rate & key behaviour — see [below](#advanced-mode).       |
| ⏲    | **Timing & Defaults**  | Tapping term, hold time and other firmware timing defaults.                |
| 🎚   | **Behaviors**          | The device's behavior definitions (hold-tap and friends) and their params. |
| ▤    | **Conditional Layers** | "When these layers are held, activate that one" rules.                     |
| ✎    | **Autocorrect**        | The on-device autocorrect dictionary — see [below](#autocorrect).          |
| ⌗    | **Node & Cluster**     | Node role and cluster address map — see [below](#node-cluster).            |
| ⚡   | **Link Profile**       | Node-bus latency / power profile — see [below](#link-profile).             |

Dialogs edit staged state: your changes go to the device when the keymap is
saved (or immediately, with [Auto-save](/guide/app/settings#communication) on).

## Unicode input

_"Unicode input method"_ picks how a `&unicode` binding types a codepoint. The
keyboard cannot detect what the host is set up for, which is why this is a
setting rather than something automatic — the dialog only offers the methods the
device reports as supported:

| Method               | Types                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| **Off**              | A `&unicode` binding types nothing.                                                                    |
| **Linux (IBus/GTK)** | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd>, the hex digits, then Enter.                             |
| **macOS**            | Holds <kbd>Option</kbd> over the hex digits. Needs the **Unicode Hex Input** keyboard layout selected. |
| **Windows**          | Holds <kbd>Alt</kbd> over keypad `+` and the hex digits. Needs the `EnableHexNumpad` registry value.   |
| **WinCompose**       | Compose, `u`, the hex digits, then Enter.                                                              |

## Autocorrect

The **Autocorrect** dialog edits the device's dictionary — one row per
`typo → correction` pair.

- **Add** appends a row; the bin icon removes one.
- **Load defaults** merges in the built-in starter list.
- Typos are trimmed, lowercased and matched case-insensitively.
- Clearing every row is a valid edit: it pushes an empty table, which is how you
  tell the device to drop its dictionary.

## Node & cluster

For boards built out of several nodes (a split, a dongle, a desk cluster), the
**Node & Cluster** dialog sets:

- **Role** — what this node is on the bus (coordinator or peripheral).
- **Input forward mode** — whether it forwards resolved output or raw events.
- **Cluster map** — for a coordinator, one row per node: hardware UID plus its
  position / encoder / pointer base, so every node's inputs land at the right
  offsets in one keymap.

## Link profile

**Link profile** tunes the node bus itself:

- **Base profile** — balanced, gaming or power-save.
- **Knob overrides** — bus baud rate, election cadence and power tier.

Ranges come from the device's live limits (with the firmware's constraint table
as a fallback), and are validated with the same rules the firmware enforces on
commit — so the dialog will not offer or save an out-of-range or inconsistent
combination. **Reset** puts a knob back to its profile default.

## Wireless settings

The **Wireless** button (📶) opens _"Wireless Settings — Power, NKRO &
connection"_:

- **Status** — transport (`usb`/`ble`), BT slot, battery level / charging,
  wireless module.
- **Low-power mode** — **Enable LPM**, **Timeout (ms)**, **Save LPM**.
- **N-Key Rollover** — **Enable NKRO**.
- **Danger zone** — **Factory reset** (_"Reset all settings to factory defaults?
  This cannot be undone."_).

## Advanced Mode

The **Advanced Mode** button (ⓘ) opens _"Advanced Mode — Debounce, report rate &
key behaviour"_:

- **Debounce** — **Response time** slider (0–80 ms) + raw **Mode**, **Save
  debounce**.
- **Report rate** — raw **Value**, **Save report rate**.
- **Snap-click** — **Enable snap-click (rapid trigger)**.
- **N-Key Rollover** — **Enable NKRO**.
- **Quick Start** — note that auto-sleep / auto-backlight-off live in the
  Wireless panel.

## Device controls

- **Bluetooth profiles** — manage BT connection slots (ZMK / Keychron).
- **Lock / unlock** — see [Connecting a device](/guide/app/connecting#unlocking).
- **Restore Stock Settings** — from the device menu, resets to the stock keymap.
- **Restore backup** — re-apply Remappr's own backup of this device's layout, see
  [Backup & restore](/guide/app/connecting#backup-restore).
- **Mesh nodes** — open the keymap of a node behind a dongle or coordinator
  (read-only today), see [The device menu](/guide/app/connecting#the-device-menu).

## See also

- [The keymap editor](/guide/editor)
- [App settings](/guide/app/settings)
- [Firmware targets & capabilities](/reference/config/firmware-targets)
