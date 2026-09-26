# Remappr dev container: Node 24 (see .nvmrc) + pnpm via corepack
# (package.json "packageManager"), plus the system libs the Electron app needs.
FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

# - build-essential, python3: electron-builder install-app-deps rebuilds the
#   native addons (node-hid, serialport) for Electron in postinstall.
# - libudev-dev, libusb-1.0-0-dev: node-hid / serialport headers (same as CI).
# - rpm, libarchive-tools: electron-builder's .rpm and .pacman targets.
# - the rest: Electron's own runtime libs, so `pnpm edev` / `pnpm estart` can start
#   when a display is forwarded into the container.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        libudev-dev \
        libusb-1.0-0-dev \
        rpm \
        libarchive-tools \
        libgtk-3-0 \
        libnss3 \
        libasound2 \
        libgbm1 \
        libxss1 \
        libxtst6 \
        libnotify4 \
        libsecret-1-0 \
    && rm -rf /var/lib/apt/lists/*

# The base image ships its own global pnpm (a newer major) ahead of corepack
# on PATH. It hands off to the pinned version but rejects some pnpm 10 flags
# (`pnpm -s ...`) first, so drop it and let corepack serve the pinned one.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm uninstall -g --prefix /usr/local/share/npm-global pnpm \
    && corepack enable
