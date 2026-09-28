# App settings

The **Settings** dialog (⚙ in the header or on the Start Page, or **App
settings** in the device menu) — _"Appearance, keycaps, workspace, start page &
device"_ — has six sections down the left. Changes show as you make them so you can see
the result; **Done** keeps them, **Cancel** (or closing the dialog) puts
everything back the way it was when you opened it.

## General

![Settings → General: theme, dark mode, key header and colour-coding](/images/app/settings-general.webp)

**Appearance**

- **Theme** — _"Choose a colour theme — light & dark variants included"_:
  **Default**, **Claude**, **Supabase**, **T3 Chat**, **Vercel**, **Twitter**,
  **Bubblegum**, **Catppuccin**. Themes recolour the whole app, keycaps
  included.
- **Dark Mode** — **Light**, **Dark** or **System** (_"follow the system"_).

**Keymap Display**

- **Key Header** — the small line at the top of each cap: **Action name**
  (_Key Press_, _Mod-Tap_), **Binding code** (`&kp`, `&mt`) or **Hidden**. Kept
  per firmware family.
- **Colour-coding** — _"Tint keys by their function group"_: **Off** (every cap
  the neutral face), **Subtle** or **Vivid**.

## Keycaps

![Settings → Keycaps: Flat, Sculpted, Mono and Glass previews](/images/app/settings-keycaps.webp)

**Keycap style** — _"How keys are drawn on the board"_. Each option shows a live
preview, including a hold-tap cap so you can see how the two legends stack:

| Style        | Looks like                                 |
| ------------ | ------------------------------------------ |
| **Flat**     | _"Single tinted tile, crisp border."_      |
| **Sculpted** | _"Skirt + lit face with depth."_ (default) |
| **Mono**     | _"Dark cap, mono legends, accent bar."_    |
| **Glass**    | _"Translucent, glowing edge."_             |

## Workspace

![Settings → Workspace: Workbench, Inspector and Command](/images/app/settings-workspace.webp)

_"How you assign actions to keys"_ — where the binding editor opens:

- **Workbench** (default) — _"Edit the selected key in a sheet below the board."_
- **Inspector** — _"A persistent panel on the right; the board reflows."_
- **Command** — _"Assign with a ⌘K palette; a layer colour-rail on the left."_

See [Workspaces](/guide/app/editing-bindings#workspaces) for what each looks like.

## Start page

![Settings → Start page: the seven news layouts](/images/app/settings-start-page.webp)

**News** — _"How releases and announcements show on the start page."_ Each
option has a small preview:

| Layout              | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| **Side rail**       | _"Pinned cards and a timeline in a column beside the devices."_ (default) |
| **What’s new feed** | _"A filterable card of updates below the device list."_                   |
| **Spotlight**       | _"A large card above the devices that rotates through news."_             |
| **Pinned banner**   | _"Only a strip with the pinned items at the top of the page."_            |
| **"New" chip**      | _"A small badge above the title that expands into recent news."_          |
| **Bell inbox**      | _"A bell in the header with an unread count."_                            |
| **Off**             | _"No news on the start page."_                                            |

**Also show the pinned banner** — _"Keep pinned announcements in a strip at the
top of the start page, whichever layout you pick."_ (Always on with **Pinned
banner**.)

News comes from two places: announcements published with the docs, and GitHub
releases — each release opens its full notes. The same list is on the docs'
[What's new](/whats-new) page.

## Communication

![Settings → Communication: firmware family, Auto-save, Auto-restore profile, and the family's own settings](/images/app/settings-communication.webp)

How Remappr talks to devices.

- **Firmware family** — _"Pick the family whose settings you want to configure.
  Connection itself still auto-detects."_ The chips under the picker list the
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
toolbar's load button. Families with nothing of their own say so (_"No ZMK-specific
settings yet."_).

## About

![Settings → About: version, download and What's new](/images/app/settings-about.webp)

- The running version (**Remappr v0.0.16**).
- **Download** — the desktop app for your OS (latest release).
- **What’s new** — the release notes of the version you are running.
- **Check for updates** — desktop app only; when a newer release exists, a
  notification offers the download and a summary of what changed.

After an update, the desktop and web apps open **What's new** on their own the
first time a new version starts — when the release brings new features.

## See also

- [Connecting a device](/guide/app/connecting)
- [Editing bindings](/guide/app/editing-bindings)
- [Advanced features](/guide/app/advanced)
