# Advanced features

On a connected device, Remappr exposes the firmware's advanced behaviors and
hardware settings — each **capability-gated**, so a panel only appears when the
board actually supports it. The screenshots here come from demo mode, whose
simulated board advertises most of them.

## The Advanced sheet

**Dynamic entries** (⇄) in the toolbar opens the Advanced sheet, a dock under
the board with one tab per kind of entry. Tabs appear only when the device
advertises that capability. Click the tool again, or **×**, to close it.

Each tab is a table: one row per entry in use, one column per setting, and every
cell edits in place (a key opens the keycode picker). Entries with more settings
open them under their row. A changed row is marked until you **Save** — the
button counts your changes (_"Save 3 changes"_) and writes them all.
**New …** takes the next free slot (_"uses #2 · 4 free"_), **Go to #** jumps to
any slot by number, and **✕** clears a row. The header shows how many slots are
in use (_"4 of 8 in use"_).

| Tab              | Shown when             | Edits                                               |
| ---------------- | ---------------------- | --------------------------------------------------- |
| **Tap dance**    | tap-dance count > 0    | Different actions per tap count and hold.           |
| **Combo**        | combo count > 0        | Keys pressed together → one output.                 |
| **Key Override** | key-override count > 0 | "This key with these mods sends something else."    |
| **Alt Repeat**   | supported              | What the alternate-repeat key sends after a key.    |
| **Macros**       | macro count > 0        | Sequences of taps, presses, releases, delays, text. |

These map to the same concepts as the config's
[`tapDances`](/reference/config/keymap-format#tapdances),
[`macros`](/reference/config/keymap-format#macros) and
[`combos`](/reference/config/keymap-format#combos) — here you edit them live on
the device (mostly VIA / Vial / Keychron).

### Tap dance {#tap-dance}

![The Tap dance tab: one row per entry with Tap, Hold, Tap twice, Tap then hold and Timing](/images/editor/advanced-sheet.webp)

One row per entry: **Tap**, **Hold**, **Tap twice**, **Tap, then hold**, and
**Timing** — how long (ms) the firmware waits to decide between them. Click a
key to change it. Bind the entry to a key with the tap-dance action in the
[binding editor](/guide/app/editing-bindings#tap-dances).

### Combo

![The Combo tab: a row with the keys pressed together and what it sends](/images/editor/advanced-combo.webp)

Up to four keys in **Press together** send what **Sends** holds. Leave unused
key slots empty.

### Key override

![The Key override tab: a row with When pressed, With mods, Sends instead and On, its layer and mod masks and options open below](/images/editor/advanced-key-override.webp)

- **When pressed** **With mods** → **Sends instead** — e.g. <kbd>Shift</kbd> +
  <kbd>Backspace</kbd> sends <kbd>Delete</kbd>; **On** enables it.
- Under the row: **Active on layers**, **Not when these mods are held**, **Hide
  these mods from the output**, and the options **Activate on trigger down**,
  **Required mod down**, **Negative mod up**, **One mod**, **No re-register**,
  **No unregister on other** — QMK's key-override flags.

### Alt repeat

![The Alt repeat tab: a row with After key, Repeat sends, Allowed mods and On, its options open below](/images/editor/advanced-alt-repeat.webp)

_"Alternate Repeat sends a different key when you repeat the last keypress —
e.g. after "a", repeat emits "o"."_ Each row pairs **After key** with what **Repeat
sends**, limited to the **Allowed mods**; **On** enables it, and the options
**Default to alt**, **Bidirectional** and **Ignore handedness** open under the
row. The protocol does not report how many slots a device has, so the table
reads slots until the device refuses one.

### Macros

![The Macros tab: a macro opened to edit its steps, with Add step and Record keys](/images/editor/macros.webp)

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
| 🕸   | **Cluster diagnostics** | Each node’s role and connection, live — see [below](#cluster-diagnostics).          |
| 🌐   | **Unicode input**       | The host unicode input method — see [below](#unicode-input).                        |
| ⏱    | **Advanced mode**       | Debounce, report rate & key behaviour — see [below](#advanced-mode).                |
| ⏲    | **Timing and defaults** | Tapping term, quick tap, combo timeout, debounce — see [below](#timing-defaults).   |
| 🎚   | **Behaviors**           | The device's hold-taps and mod-morphs — see [below](#behaviors).                    |
| ▤    | **Conditional layers**  | "When these layers are held, activate that one" — see [below](#conditional-layers). |
| ✎    | **Autocorrect**         | The on-device autocorrect dictionary — see [below](#autocorrect).                   |
| ⌗    | **Node and cluster**    | Node role and cluster address map — see [below](#node-cluster).                     |
| ⚡   | **Link profile**        | How fast nodes talk, and power use — see [below](#link-profile).                    |

Dialogs edit staged state: your changes go to the device when the keymap is
saved (or immediately, with [Auto-save](/guide/app/settings#communication) on).

## Timing and defaults {#timing-defaults}

_"Behavior timing pushed to the device."_

![Timing and defaults: tap-hold & combo, debounce and engine timing fields](/images/editor/dialog-timing.webp)

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

![Cluster diagnostics: this node's role, connected nodes with their state, role changes, and the raw-values table with Copy for support](/images/editor/dialog-cluster-diagnostics.webp)

- **This node** — its current role (_Main node_ or _Follower_); **↻** refreshes.
- **Connected nodes** — one card per port with the node's role and link, in
  plain words: _Connected and responding_, _Connected, not responding_ or
  _Not connected_.
- **Role changes** — role changes as they happen (the main node dropping out
  and another taking over). If the firmware sets each node's role at start-up,
  this stays empty.
- **Raw values** — one table of the raw numbers behind the status (role, link
  up, seen, election round, flags). **Copy for support** copies it as text for
  a bug report.

## Node and cluster {#node-cluster}

_"What this node does in the group, and how it sends key presses."_

![Node and cluster: cluster role, input forwarding, cluster address map](/images/editor/dialog-node-cluster.webp)

- **Cluster role** — what this node is in the group (_Main node_ or
  _Follower_), or _Firmware default_.
- **Input forwarding** — _Send finished key presses_ or _Send key positions_
  (the main node then looks each position up in the shared keymap).
- **Cluster address map** — for the main node, one row per node (**+ Add
  node**): hardware UID plus its position / encoder / pointer base, so every
  node's inputs land at the right offsets in one keymap.

## Link profile

_"How fast nodes talk, how quickly a main node is chosen, and power use."_

![Link profile: base profile and advanced values with their ranges](/images/editor/dialog-link-profile.webp)

- **Base profile** — _Balanced_, _Gaming_ or _Power save_.
- **Advanced values** — wire speed, wait before choosing a main node,
  heartbeat period, missed check-ins allowed, settle time, demotion delay,
  minimum time between handovers, power tier. Each shows its range and the
  profile's default.

Ranges come from the device's live limits (with the firmware's constraint table
as a fallback), and are validated with the same rules the firmware enforces on
commit — so the dialog will not offer or save an out-of-range or inconsistent
combination. **Reset** puts a value back to its profile default.

## Wireless settings

The **Wireless** button (📶) opens _"Wireless settings — Power, NKRO and
connection"_:

- **Status** — transport (`usb`/`ble`), BT slot, battery level / charging,
  wireless module.
- **Low-power mode** — **Low-power mode**, **Timeout (ms)**, **Save**.
- **N-key rollover** — **Send every key at once (NKRO)**.
- **Danger zone** — **Factory reset** (_"Reset all settings to factory defaults?
  This cannot be undone."_).

## Advanced mode {#advanced-mode}

The **Advanced mode** button (ⓘ) opens _"Advanced mode — Debounce, report rate &
key behaviour"_:

- **Debounce** — **Response time** slider (0–80 ms) + raw **Mode**, **Save
  debounce**.
- **Report rate** — raw **Value**, **Save report rate**.
- **Snap-click** — **Enable snap-click (rapid trigger)**.
- **N-key rollover** — **Send every key at once (NKRO)**.
- **Quick start** — note that auto-sleep / auto-backlight-off live in the
  Wireless panel.

## Device controls

- **Bluetooth profiles** — manage BT connection slots (ZMK / Keychron).
- **Lock / unlock** — see [Connecting a device](/guide/app/connecting#unlocking).
- **Restore stock settings** — from the device menu, resets to the stock keymap.
- **Restore backup** — re-apply Remappr's own backup of this device's layout, see
  [Backup & restore](/guide/app/connecting#backup-restore).
- **Mesh nodes** — open a node behind a dongle or main node: a mouse or a
  joystick to edit, a keyboard's keymap read-only, see
  [The device menu](/guide/app/connecting#the-device-menu).

## See also

- [The keymap editor](/guide/editor)
- [Editing bindings](/guide/app/editing-bindings)
- [App settings](/guide/app/settings)
- [Firmware targets & capabilities](/reference/config/firmware-targets)
