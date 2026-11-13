# Installation

Remappr runs two ways:

- **In the browser** — open [remappr.com](https://remappr.com). Nothing to
  install; uses WebHID / Web Serial / Web Bluetooth (Chromium-based browsers).
- **As a desktop app (Electron)** — native HID, serial and BLE transports, no
  browser device-picker limitations. Recommended for daily use.

All desktop builds are published on the
[GitHub Releases page](https://github.com/Wolffyx/remappr/releases/latest).
Artifact names follow `remappr-electron-<version>.<ext>` (e.g.
`remappr-electron-0.0.12.AppImage`). The Linux tarball additionally carries a
`-linux` suffix (`remappr-electron-<version>-linux.tar.gz`) — it is **not** a
macOS or Windows download.

## Linux

Pick the package that matches your distribution. All of them install the same
app; the AppImage and tarball are distro-agnostic fallbacks.

| Distro          | Artifact        | Install command                          |
| --------------- | --------------- | ---------------------------------------- |
| Arch / Manjaro  | `.pacman`       | `sudo pacman -U <file>.pacman`           |
| Debian / Ubuntu | `.deb`          | `sudo apt install ./<file>.deb`          |
| Fedora / RHEL   | `.rpm`          | `sudo dnf install ./<file>.rpm`          |
| Any             | `.AppImage`     | `chmod +x`, then run                     |
| Any             | `-linux.tar.gz` | extract, run the `remappr` binary inside |

### Arch Linux / Manjaro

```bash
curl -LO https://github.com/Wolffyx/remappr/releases/latest/download/remappr-electron-0.0.12.pacman
sudo pacman -U remappr-electron-0.0.12.pacman
```

(Replace the version with the latest release.) `pacman -U` resolves the
package's declared dependencies from the repos automatically.

### Debian / Ubuntu

```bash
curl -LO https://github.com/Wolffyx/remappr/releases/latest/download/remappr-electron-0.0.12.deb
sudo apt install ./remappr-electron-0.0.12.deb
```

Use `apt install ./file.deb` (not `dpkg -i`) so missing dependencies are pulled
in automatically.

### Fedora / RHEL / openSUSE

```bash
curl -LO https://github.com/Wolffyx/remappr/releases/latest/download/remappr-electron-0.0.12.rpm
sudo dnf install ./remappr-electron-0.0.12.rpm
```

On openSUSE use `sudo zypper install ./remappr-electron-<version>.rpm`.

### AppImage (any distro)

```bash
chmod +x remappr-electron-0.0.12.AppImage
./remappr-electron-0.0.12.AppImage
```

AppImages need FUSE 2 at runtime. If launch fails with a `libfuse.so.2` /
`fusermount` error:

- **Debian / Ubuntu ≥ 22.04:** `sudo apt install libfuse2` (24.04+: `libfuse2t64`)
- **Fedora:** `sudo dnf install fuse fuse-libs`
- **Arch:** `sudo pacman -S fuse2`

As a last resort, `./remappr-….AppImage --appimage-extract` unpacks it and
`squashfs-root/AppRun` runs without FUSE.

### Tarball (any distro)

```bash
tar -xzf remappr-electron-0.0.12-linux.tar.gz
cd remappr-0.0.12 && ./remappr
```

No desktop integration (menu entry, icon) — prefer a native package or the
AppImage unless you know you want this.

### Device permissions on Linux

The desktop app talks to keyboards over three transports; each needs OS-level
access:

#### Raw HID (QMK / VIA / Vial / Keychron)

`/dev/hidraw*` nodes are root-only by default. Add a udev rule so your desktop
session gets access:

```bash
sudo tee /etc/udev/rules.d/92-remappr.rules > /dev/null <<'EOF'
KERNEL=="hidraw*", SUBSYSTEM=="hidraw", MODE="0660", TAG+="uaccess"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Unplug and replug the keyboard afterwards. (`TAG+="uaccess"` grants access to
the active logged-in session via systemd-logind — the same rule VIA and Vial
document.)

#### Remappr joystick deadzones

Linux gives every USB gamepad axis a deadzone of its own (`flat`, an eighth
of the way out), on top of the one the joystick already applies. Programs
that honour it, such as SDL games with `SDL_JOYSTICK_LINUX_DEADZONES=1` and
calibration tools, then add a second dead middle. Turn it off for the Remappr
Joystick:

```bash
sudo tee /etc/udev/hwdb.d/61-remappr-joystick.hwdb > /dev/null <<'END'
# Remappr Joystick: its deadzones are the firmware's.
evdev:input:b0003v1209p0004*
 EVDEV_ABS_00=::::0
 EVDEV_ABS_01=::::0
 EVDEV_ABS_02=::::0
 EVDEV_ABS_03=::::0
 EVDEV_ABS_04=::::0
 EVDEV_ABS_05=::::0
END
sudo systemd-hwdb update && sudo udevadm trigger -s input
```

The old joystick interface (`/dev/input/js*`) works out its correction when
the joystick is plugged in, before this rule applies; the few programs that
still read it keep the extra deadzone unless you reset it with `jscal`.

#### USB serial (ZMK over CDC-ACM)

`/dev/ttyACM*` devices belong to a group — add yourself to it, then log out and
back in:

- **Debian / Ubuntu / Fedora:** `sudo usermod -aG dialout $USER`
- **Arch:** `sudo usermod -aG uucp $USER`

#### BLE (ZMK / Keychron wireless)

BLE uses **BlueZ over D-Bus** directly — make sure the Bluetooth service is
running:

```bash
sudo systemctl enable --now bluetooth
```

No extra permissions are normally needed; the default BlueZ/polkit policy
allows active desktop sessions to scan and pair.

## macOS

Download the `.dmg` (a single **universal** build — runs natively on both
Intel and Apple Silicon), open it and drag **Remappr** into **Applications**.
The `.dmg` is the **only** macOS download — the `…-linux.tar.gz` is a Linux
build; opening the binary inside it fails with _"this application is not
supported on this type of Mac"_.

::: warning Gatekeeper — "Apple could not verify…" / "Remappr is damaged"
Remappr is an open-source project without an Apple Developer ID, so builds are
not notarized and the **first** launch is blocked by Gatekeeper. Allowing it
once is enough. (The same steps ship inside the DMG as
`how-to-open.html`.)

**macOS 15 (Sequoia) and later** — the right-click → Open bypass was removed
in macOS 15, so:

1. Double-click the app once; in the "could not verify" dialog choose
   **Done** (not "Move to Trash").
2. Open **System Settings → Privacy & Security**, scroll to the **Security**
   section — "Remappr was blocked…" — and click **Open Anyway**.
3. Confirm with Touch ID / password.

**macOS 14 (Sonoma) and earlier** — **right-click** (or
<kbd>Ctrl</kbd>-click) the app in Applications → **Open** → **Open**.

**Any version** — clear the quarantine flag from a terminal instead:

```bash
xattr -dr com.apple.quarantine /Applications/Remappr.app
```

:::

On first BLE use macOS asks for **Bluetooth** permission — approve it (also
manageable later under **System Settings → Privacy & Security → Bluetooth**).
No extra setup is needed for HID or serial devices.

## Windows

Download `remappr-electron-<version>-setup.exe` and run it. Windows
SmartScreen may warn about an unrecognized app — choose **More info → Run
anyway** (builds are unsigned).

For ZMK over USB no driver setup is needed on Windows 10+; CDC-ACM is
built in.

## Updating

Grab the newer package from
[Releases](https://github.com/Wolffyx/remappr/releases/latest) and install it
over the old one (`pacman -U` / `apt install` / `dnf install` upgrade in
place; on macOS replace the app in Applications). Older releases keep their
notes but their binaries are pruned — always download from the latest release.
