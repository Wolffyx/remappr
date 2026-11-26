# Connecting a device

When you open Remappr you land on the **Start Page** — _"Configure your devices
— Connect your keyboard, mouse or controller to customize keymaps and settings."_ It is where you
connect hardware, open the builder, or try the demo.

![The Start Page: Available devices, the news rail, the Create a keyboard card, and the Try the demo / Get the desktop app cards](/images/app/start-page.webp)

The top bar holds the logo and version on the left, the project links
(GitHub, Discord, documentation, ♥ support) in the middle, and **Settings** on
the right. The right-hand column is the news rail — releases and
announcements; pick another layout, or turn it off, in
[Settings → Start page](/guide/app/settings#start-page).

## Connect to a keyboard

The **Available devices** card lists detected devices. Until a board has been
paired it reads _"No paired devices"_: browsers only show keyboards you have
already allowed for this site, so **Pair new device** opens the system chooser
to pick one. Paired boards come back as cards with a small preview of their
layout (shape and key colours only — never your bindings) and a **Connect**
button.

- _"Select a device to connect"_ (or _"Select a connection type"_ for
  simple-connect transports).
- The **Refresh** button (↻) re-scans.
- Supported transports:
    - **ZMK** — USB/serial (CDC-ACM) or BLE; the board needs ZMK Studio enabled.
    - **QMK / VIA / Vial** — raw HID via the VIA protocol.
    - **Keychron** — VIA/QMK + a BLE radio.
    - **Remappr Firmware** — USB; keyboards, [mice](/guide/devices/mice) and
      [joysticks](/guide/devices/gamepads).

Pick a device and Remappr opens the [keymap editor](/guide/editor) on its live
keymap, showing only the features that firmware supports. A mouse or a
controller opens in the [device editor](/guide/devices/device-editor) instead.

## Controllers & mice

Below the firmware devices, **Controllers & mice** lists the game controllers
and mice Remappr can see without a vendor protocol: _"View and live test · no
vendor protocol"_. Click one to open it read-only and test it live. Browsers
only reveal a controller after it has been used, hence _"Controller not
listed? Press any button on it."_ See
[Generic controllers & mice](/guide/devices/generic-hid).

## Unlocking

Some boards require unlocking before editing. You'll see an **Unlock To
Continue** overlay — _"For security reasons, your device requires unlocking
before using Remappr."_ On ZMK this means assigning the
[Studio Unlock](https://zmk.dev/docs/keymaps/behaviors/studio-unlock) behavior to
a key or combo and pressing it.

## The device menu

Once connected, the device card at the bottom of the sidebar shows the device
name and **Connected · USB** (or **BLE**). Its gear opens the device menu:

![The device menu open from the device card: Disconnect, Restore stock settings, App settings](/images/app/device-menu.webp)

Entries depend on the device and the firmware:

- **Mesh nodes** — only on devices that report other nodes behind them (a dongle
  or a split main node). Lists each node, marks the one you are viewing with a
  check and offline nodes as _offline_; picking one opens that node. While
  viewing a node the first entry becomes **Back to _(parent)_**. A mouse or a
  joystick opens in the device editor and is edited through the dongle; a
  keyboard's keymap opens read-only.
- **Auto-connect on launch** — a checkbox, shown once the device has been paired
  at least once. When ticked, Remappr reconnects to this device automatically the
  next time it starts. A manual **Disconnect** stops the reconnect loop for that
  session, so unticking is not needed just to work on another board.
- **Disconnect**
- **Restore backup** — only when the firmware supports profile restore and
  Remappr holds a backup for this device (see below).
- **Restore stock settings** — _"removes any customizations previously made in
  Remappr and restores the stock keymap."_
- **App settings** — opens the [Settings dialog](/guide/app/settings).

Leaving a device that holds unsaved changes (**Disconnect**, the Remappr logo,
**Back to _(parent)_**, another node, or another device) first asks _"Save
changes to (device)?"_ with **Save**, **Discard** and **Cancel**. **Save** writes
the changes and then leaves; if the device refuses them the dialog stays open.
**Discard** drops them and leaves. **Cancel** stays where you are. With
[Auto-save](/guide/app/settings#communication) on, changes still waiting to be
written are saved on the way out without asking. Demo devices never ask.

In the desktop app, closing the window (its close button, Alt+F4, the taskbar),
quitting, or reloading it with Ctrl+R asks the same question. A reload from the
app menu cannot wait for a save, so it asks _"Leave without saving?"_ with
**Leave** and **Stay** instead. In a browser tab, closing or reloading shows the
browser's own _"Leave site?"_.

## Backup & restore

Remappr keeps a local backup of each device's layout, keyed per device, and
refreshes it as you edit. On firmwares that advertise profile restore (**ZMK**
today) it can put that layout back:

- **Automatic prompt** — if a device reconnects wiped or reset (a flash, a
  settings-erase, a factory reset), Remappr shows _"Restore your layout?"_ with
  the date of the last backup. Accept and it re-applies the stored keymap.
- **Manual** — **Restore backup** in the device menu re-applies the stored layout
  at any time.
- **Skip the prompt** — turn on **Auto-restore profile** in
  [Settings → Communication](/guide/app/settings#communication) and Remappr
  restores silently instead of asking.

Backups cover the keymap (keys and layers). They are stored on this machine — see
[Cloud sync](/guide/roadmap#app-level) on the roadmap for the hosted version.

## Create a keyboard

The **Create a keyboard** card (badge **BUILDER**) opens the
[Builder](/guide/builder/overview): _"Design a board from scratch — layout,
matrix & firmware. Import KLE, start from a preset, then export a build-ready
config."_ During alpha/beta it shows a **{stage} · FREE** badge and **Open
builder**; at GA it becomes premium (**🔒 Premium**).

## Try the demo {#try-demo-mode}

**Try the demo** — _"Explore Remappr with simulated keyboards, a mouse and
controllers — no device required."_ **Try demo** opens _"Try a demo device"_:
pick the 36-key **Corne** (with a rotary encoder) for the keymap editor, or a
macro pad, mouse, gamepad or flight stick (see
[the demo devices](/guide/devices/overview#try-it-without-hardware)). It is the
same config-driven flow as a real device. Every screenshot in this section of
the docs was taken in demo mode, so you can follow along without hardware.

The demo keeps nothing: there is no **Save** button (there is no device to
write to), and **Disconnect** returns to the Start Page with the board as it
was.

## Get the desktop app

**Get the desktop app** downloads the latest Remappr build for your OS — the
desktop app has native USB/BLE/HID access the browser can't always provide.

## Support this project

The **♥ Support this project** button — on the Start Page and in the editor
header — opens _"Support this project — help keep Remappr free and
open-source"_, with links to GitHub Sponsors, Ko-fi and Open Collective.

## Next

[The keymap editor →](/guide/editor)
