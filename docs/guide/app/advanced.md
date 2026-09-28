# Advanced features

On a connected device, Remappr exposes the firmware's advanced behaviors and
hardware settings — each **capability-gated**, so a panel only appears when the
board actually supports it. The screenshots here come from demo mode, whose
simulated board advertises most of them.

## The Advanced sheet

**Dynamic entries** (⇄) and **Macros** (✦) in the header open the Advanced sheet,
a dock under the board with one tab per kind of entry. Tabs appear only when the
device advertises that capability. Click the header button again, or **×**, to
close it.

Each tab edits one numbered **Entry** at a time — the number box at the top-right
picks which (_"of 4"_: the device has four slots) — and **Save** writes that
entry to the device.

| Tab              | Shown when             | Edits                                               |
| ---------------- | ---------------------- | --------------------------------------------------- |
| **Tap Dance**    | tap-dance count > 0    | Different actions per tap count and hold.           |
| **Combo**        | combo count > 0        | Keys pressed together → one output.                 |
| **Key Override** | key-override count > 0 | "This key with these mods sends something else."    |
| **Alt Repeat**   | supported              | What the alternate-repeat key sends after a key.    |
| **Macros**       | macro count > 0        | Sequences of taps, presses, releases, delays, text. |

These map to the same concepts as the config's
[`tapDances`](/reference/config/keymap-format#tapdances),
[`macros`](/reference/config/keymap-format#macros) and
[`combos`](/reference/config/keymap-format#combos) — here you edit them live on
the device (mostly VIA / Vial / Keychron).

### Tap Dance

![The Tap Dance tab: TAP, HOLD, DOUBLE TAP and TAP + HOLD slots with a TERM in ms](/images/editor/advanced-sheet.webp)

One row per entry: **TAP**, **HOLD**, **DOUBLE TAP**, **TAP + HOLD**, and
**TERM** — how long (ms) the firmware waits to decide between them. Click a
slot to pick its key. Bind the entry to a key with the tap-dance action in the
[binding editor](/guide/app/editing-bindings#tap-dances).

### Combo

![The Combo tab: four trigger keys and an output](/images/editor/advanced-combo.webp)

Up to four **TRIGGER KEYS** pressed together send the **OUTPUT**. Leave unused
trigger slots empty.

### Key Override

![The Key Override tab: trigger, mods, replacement, layer mask and option checkboxes](/images/editor/advanced-key-override.webp)

- **TRIGGER** **WITH MODS** → **REPLACE WITH** — e.g. <kbd>Shift</kbd> +
  <kbd>Backspace</kbd> sends <kbd>Delete</kbd>.
- **LAYER MASK** — the layers it applies on; **NEGATIVE MODS** — mods that must
  _not_ be held; **SUPPRESSED MODS** — mods removed from the output.
- Options: **Enabled**, **Required mod down**, **One mod**, **No unregister on
  other**, **Activate on trigger down**, **Negative mod up**, **No re-register**
  — QMK's key-override flags.

### Alt Repeat

![The Alt Repeat tab: after key, repeat emits, allowed mods](/images/editor/advanced-alt-repeat.webp)

_"Alternate Repeat sends a different key when you repeat the last keypress —
e.g. after "a", repeat emits "o"."_ Each entry (up to the device's maximum —
_"max 31"_ here) pairs **AFTER KEY** with what **REPEAT EMITS**, limited to the
**ALLOWED MODS**; options **Enabled**, **Bidirectional**, **Default to alt** and
**Ignore handedness**.

### Macros

![The Macros tab: an empty macro with Add action and Record](/images/editor/macros.webp)

A macro is a list of actions — tap, press, release, delay, type text. **+ Add
action** appends a step; **Record** captures what you type as steps. Bind a macro
from the **Macros** tab of the binding editor's picker.

## Capability-gated dialogs

Right of the Macros button, the header renders one icon per dialog the connected
firmware advertises. A button that is not there means the device never reported
that capability — nothing is hidden behind a setting. In toolbar order:

| Icon | Dialog                  | Opens                                                                               |
| ---- | ----------------------- | ----------------------------------------------------------------------------------- |
| 📶   | **Wireless**            | Power, NKRO & connection — see [below](#wireless-settings).                         |
| 🕸   | **Cluster diagnostics** | Node-bus roles and live role changes — see [below](#cluster-diagnostics).           |
| 🌐   | **Unicode input**       | The host unicode input method — see [below](#unicode-input).                        |
| ⏱    | **Advanced Mode**       | Debounce, report rate & key behaviour — see [below](#advanced-mode).                |
| ⏲    | **Timing & Defaults**   | Tapping term, quick tap, combo timeout, debounce — see [below](#timing-defaults).   |
| 🎚   | **Behaviors**           | The device's hold-taps and mod-morphs — see [below](#behaviors).                    |
| ▤    | **Conditional Layers**  | "When these layers are held, activate that one" — see [below](#conditional-layers). |
| ✎    | **Autocorrect**         | The on-device autocorrect dictionary — see [below](#autocorrect).                   |
| ⌗    | **Node & Cluster**      | Node role and cluster address map — see [below](#node-cluster).                     |
| ⚡   | **Link Profile**        | Node-bus latency / power profile — see [below](#link-profile).                      |

Dialogs edit staged state: your changes go to the device when the keymap is
saved (or immediately, with [Auto-save](/guide/app/settings#communication) on).

## Timing & Defaults

_"Behavior timing pushed to the device."_

![Timing & Defaults: tap-hold & combo, debounce and engine timing fields](/images/editor/dialog-timing.webp)

- **Tap-hold & combo** — **Tapping term** (_"Hold-vs-tap decision window"_),
  **Quick tap** (_"Tap-then-hold within this window repeats the tap"_), **Combo
  timeout** (_"Max time between the keys of a combo"_).
- **Debounce** — release, press, matrix-press and matrix-release debounce;
  **0** keeps the firmware's own value.
- **Engine timing** — **Caps-word idle** (leave caps-word after this idle time,
  0 = never) and **Sticky release** (sticky-key lifetime, 0 = until the next key).

## Behaviors

_"Custom hold-taps & mod-morphs pushed to the device."_

![Behaviors: two hold-taps with flavor, tapping term, quick tap, prior idle and toggles](/images/editor/dialog-behaviors.webp)

- **Hold-taps** — one card per hold-tap the keymap defines (`ht_home_row`,
  `ht_layer_tap`…): **Flavor** (_balanced_, _hold-preferred_, _tap-preferred_,
  _tap-unless-interrupted_), **Tapping term**, **Quick tap**, **Require prior
  idle**, and the **Retro tap** and **Trigger hold on release** switches.
- **Mod-morphs** — keys that send something else while a modifier is held
  (`,` → `;` with Shift).

## Conditional layers

_"Auto-activate a layer while other layers are held (tri-layer)."_

![Conditional layers: a tri-layer rule — the layer chips to watch and the layer to activate](/images/editor/dialog-conditional-layers.webp)

Each rule reads _"When these layers are all active"_ (toggle the layer chips) →
**activate** a layer. The classic tri-layer: holding _lower_ and _raise_
together turns on _adjust_. **+ Add tri-layer** adds a rule; the bin removes one.

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

_"Misspellings the keyboard fixes as you type."_

![Autocorrect: the explanation, Add entry and Load starter list](/images/editor/dialog-autocorrect.webp)

The dialog edits the device's dictionary — one row per `typo → correction`
pair. The keyboard watches the letters you type and, the moment they end with
one of the misspellings, deletes it and types the correction instead.

- **Add entry** appends a row; the bin icon removes one.
- **Load starter list** merges in the built-in list of common English typos.
- Typos are trimmed, lowercased and matched case-insensitively.
- Clearing every row is a valid edit: it pushes an empty table, which is how you
  tell the device to drop its dictionary.

## Cluster diagnostics

For boards built out of several nodes on a node bus.

![Cluster Diagnostics: this node's role, node-bus peers with their state, live role transitions](/images/editor/dialog-cluster-diagnostics.webp)

- **This node** — its current role (_coordinator_ or _follower_).
- **Node-bus peers** — one card per port with the peer's role and state.
- **Live role transitions** — role changes as they happen (a coordinator
  dropping out and another taking over); **↻** refreshes.

## Node & cluster

_"Cluster role, input forwarding, and the mode-A position map."_

![Node & cluster: cluster role, input forwarding, cluster address map](/images/editor/dialog-node-cluster.webp)

- **Cluster role** — what this node is on the bus (coordinator or peripheral),
  or _Firmware default_.
- **Input forwarding** — whether it forwards resolved HID output or raw events.
- **Cluster address map** — for a coordinator, one row per node (**+ Add
  node**): hardware UID plus its position / encoder / pointer base, so every
  node's inputs land at the right offsets in one keymap.

## Link profile

_"Node-bus latency, election cadence, and power tier."_

![Link profile: base profile and knob overrides with their ranges](/images/editor/dialog-link-profile.webp)

- **Base profile** — _Balanced_, _Gaming_ or _Power-save_.
- **Knob overrides** — bus baud rate, election window, heartbeat period, missed
  beacon limit, candidacy and demotion timing, power tier. Each shows its range
  and the profile's default.

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
- [Editing bindings](/guide/app/editing-bindings)
- [App settings](/guide/app/settings)
- [Firmware targets & capabilities](/reference/config/firmware-targets)
