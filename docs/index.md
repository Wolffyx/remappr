---
layout: home

hero:
    name: Remappr
    text: One universal device manager.
    tagline: Connect, remap, light up and build your devices across firmwares — ZMK, QMK, VIA, Vial and Keychron today, more to come. One visual builder, one JSON config, every target.
    image:
        src: /remappr.webp
        alt: Remappr
    actions:
        - theme: brand
          text: Get started
          link: /guide/getting-started
        - theme: alt
          text: Config reference
          link: /reference/config/overview
        - theme: alt
          text: Open the app ↗
          link: https://remappr.com

features:
    - title: The Builder
      details: Lay out a board from a preset, KLE import, ortho grid or key-by-key. Wire the matrix, set the controller, pick firmware targets — all on one canvas.
      link: /guide/builder/overview
      linkText: Builder walkthrough
    - title: One JSON config
      details: A single source-of-truth keymap.json. Write keys as bare strings or full action objects; the same file drives the live editor and every firmware export.
      link: /reference/config/keymap-format
      linkText: Keymap format
    - title: Multi-firmware export
      details: Export & build emits a ready-to-push project per target — config + GitHub Actions workflow + README. Push it, download the .uf2/.hex, flash.
      link: /guide/builder/export-build-flash
      linkText: Export, build & flash
---

## What lives here

Remappr has two newest, most powerful subsystems, both documented here:

- **The [Builder](/guide/builder/overview)** — a full-screen visual tool for
  designing a keyboard from scratch: physical layout, matrix wiring, controller,
  lighting, layers and bindings.
- **The [JSON keymap config](/reference/config/overview)** — the generalized,
  firmware-agnostic document that is the single source of truth. One config file
  → per-firmware compilers → flashable projects.

If you want to **change a keymap on a connected board**, start with
[Getting Started](/guide/getting-started). If you want to **understand or
hand-write the config**, jump to the [Config Reference](/reference/config/overview).
If you want to **add a firmware target or hack on the compilers**, see the
[Developer docs](/dev/architecture).
