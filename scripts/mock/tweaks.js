// Pattern check: Dispatch Map (Tier 0) — applied — screen id → navigation steps and
// tweak id → storage writer, instead of branching chains.
//
// Remappr mock — a Tweaks panel layered on the real app build (demo devices).
// Tweaks write the app's own persisted settings (the same keys its Settings dialog
// writes) and reload; "Screens" replays clicks from the start page to land on any
// screen. Nothing here is part of the app; delete this script and the app is stock.
;(function () {
    'use strict'

    const PALETTES = [
        ['default', 'Default'],
        ['claude', 'Claude'],
        ['supabase', 'Supabase'],
        ['t3-chat', 'T3 Chat'],
        ['vercel', 'Vercel'],
        ['twitter', 'Twitter'],
        ['bubblegum', 'Bubblegum'],
        ['catppuccin', 'Catppuccin'],
    ]
    const KEYS = {
        mode: 'vite-ui-theme',
        palette: 'vite-ui-theme-name',
        settings: 'user-settings-store',
        lighting: 'remappr.rgb',
        coach: 'remappr-coach-done',
        mock: 'remappr-mock',
        goto: 'remappr-mock-goto',
    }
    const SETTINGS_VERSION = 9

    // ---------- storage ----------
    function readJson(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || 'null')
        } catch (e) {
            console.warn('[mock] bad JSON in', key, e)
            return null
        }
    }
    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value))
    }
    function zState(key) {
        const v = readJson(key)
        return v && v.state
            ? v
            : {
                  state: {},
                  version: key === KEYS.settings ? SETTINGS_VERSION : 0,
              }
    }
    function patchZustand(key, patch) {
        const v = zState(key)
        v.state = Object.assign({}, v.state, patch)
        writeJson(key, v)
    }
    function settings() {
        return zState(KEYS.settings).state
    }
    function mockPrefs() {
        return readJson(KEYS.mock) || { open: true }
    }
    function setMockPrefs(patch) {
        writeJson(KEYS.mock, Object.assign(mockPrefs(), patch))
    }

    // ---------- current values ----------
    function current() {
        const s = settings()
        const l = zState(KEYS.lighting).state
        const kd = s.keyDisplayMode || {}
        return {
            palette: localStorage.getItem(KEYS.palette) || 'default',
            mode: localStorage.getItem(KEYS.mode) || 'system',
            capStyle: s.capStyle || 'sculpted',
            colorMode: s.colorMode || 'subtle',
            keyHeader: kd._default || 'displayName',
            workspace: s.workspace || 'workbench',
            newsStyle: s.newsStyle || 'rail',
            newsPinnedBanner: !!s.newsPinnedBanner,
            autosave: !!s.autosave,
            lightEffect: l.effect || 'rainbow',
            lightHue: typeof l.hue === 'number' ? l.hue : 286,
            lightBright: typeof l.bright === 'number' ? l.bright : 72,
            tours: !localStorage.getItem(KEYS.coach),
        }
    }

    // ---------- appliers (tweak id → write) ----------
    function applyThemeNow() {
        const v = current()
        const root = document.documentElement
        const dark =
            v.mode === 'dark' ||
            (v.mode === 'system' &&
                matchMedia('(prefers-color-scheme: dark)').matches)
        root.classList.remove('light', 'dark')
        root.classList.add(dark ? 'dark' : 'light')
        if (v.palette === 'default') root.removeAttribute('data-theme')
        else root.setAttribute('data-theme', v.palette)
    }
    const APPLY = {
        palette: (v) => (localStorage.setItem(KEYS.palette, v), 'live'),
        mode: (v) => (
            localStorage.setItem(KEYS.mode, v),
            patchZustand(KEYS.settings, {
                theme: v === 'light' ? 'light' : 'dark',
            }),
            'live'
        ),
        capStyle: (v) => (
            patchZustand(KEYS.settings, { capStyle: v }),
            'reload'
        ),
        colorMode: (v) => (
            patchZustand(KEYS.settings, { colorMode: v }),
            'reload'
        ),
        keyHeader: (v) => {
            const kd = Object.assign({}, settings().keyDisplayMode || {})
            Object.keys(kd).forEach((k) => (kd[k] = v))
            kd._default = v
            patchZustand(KEYS.settings, { keyDisplayMode: kd })
            return 'reload'
        },
        workspace: (v) => (
            patchZustand(KEYS.settings, { workspace: v }),
            'reload'
        ),
        newsStyle: (v) => (
            patchZustand(KEYS.settings, { newsStyle: v }),
            'reload'
        ),
        newsPinnedBanner: (v) => (
            patchZustand(KEYS.settings, { newsPinnedBanner: v }),
            'reload'
        ),
        autosave: (v) => (
            patchZustand(KEYS.settings, { autosave: v }),
            'reload'
        ),
        lightEffect: (v) => (
            patchZustand(KEYS.lighting, { effect: v }),
            'reload'
        ),
        lightHue: (v) => (
            patchZustand(KEYS.lighting, { hue: Number(v) }),
            'reload'
        ),
        lightBright: (v) => (
            patchZustand(KEYS.lighting, { bright: Number(v) }),
            'reload'
        ),
        tours: (v) => {
            if (v) localStorage.removeItem(KEYS.coach)
            else localStorage.setItem(KEYS.coach, '1')
            patchZustand(KEYS.settings, { seenBuilderTour: !v })
            return 'reload'
        },
    }
    function setTweak(id, value) {
        const how = APPLY[id](value)
        if (how === 'live') {
            applyThemeNow()
            render()
            return
        }
        reloadInto(mockPrefs().screen || 'start')
    }

    // ---------- navigation ----------
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    async function waitFor(fn, timeout) {
        const end = Date.now() + (timeout || 5000)
        while (Date.now() < end) {
            const v = fn()
            if (v) return v
            await sleep(80)
        }
        throw new Error('[mock] timed out waiting for the app')
    }
    function press(el) {
        const opts = {
            bubbles: true,
            cancelable: true,
            pointerType: 'mouse',
            button: 0,
        }
        ;['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((t) =>
            el.dispatchEvent(new PointerEvent(t, opts)),
        )
        el.click()
    }
    const buttons = () => [
        ...document.querySelectorAll('#root button, [role=dialog] button'),
    ]
    const byPrefix = (p) => () =>
        buttons().find((b) => b.textContent.trim().startsWith(p))
    const byIncludes = (p) => () =>
        buttons().find((b) => b.textContent.includes(p))
    const headerBtn = (icon) => () =>
        [...document.querySelectorAll('header button')].find((b) => {
            const svg = b.querySelector('svg')
            return (
                svg &&
                (svg.getAttribute('class') || '')
                    .split(/\s+/)
                    .includes('lucide-' + icon)
            )
        })
    const click = (find, settle) => async () => {
        press(await waitFor(find))
        await sleep(settle || 450)
    }
    const skipTours = async () => {
        await sleep(300)
        const skip = buttons().find((b) => b.textContent.trim() === 'Skip')
        if (skip) press(skip)
        document
            .querySelectorAll('[data-sonner-toast]')
            .forEach((t) => t.remove())
        await sleep(200)
    }
    const demo = [click(byPrefix('Try Demo'), 700)]
    const device = (label) => [...demo, click(byPrefix(label), 1400), skipTours]
    const corne = device('Corne')
    const mouse = device('Halo M2')
    const builder = [click(byIncludes('Open builder'), 1400), skipTours]
    const tool = (icon) => [...corne, click(headerBtn(icon), 900)]

    // screen id → [group, label, steps]
    const SCREENS = {
        start: ['Start', 'Start page', []],
        demo: ['Start', 'Try a demo device', demo],
        corne: ['Keyboard', 'Keymap editor (Corne)', corne],
        'corne-key': [
            'Keyboard',
            'Key selected + picker',
            [...corne, click(byPrefix('Mod-TapA'), 700)],
        ],
        lighting: ['Keyboard', 'Lighting dock', tool('lightbulb')],
        tapdance: ['Keyboard', 'Tap dance & combos', tool('sliders-vertical')],
        macros: ['Keyboard', 'Macros', tool('sparkles')],
        settings: ['Dialogs', 'Settings', tool('settings')],
        export: ['Dialogs', 'Configuration export', tool('download')],
        'typing-load': ['Dialogs', 'Typing load', tool('chart-column')],
        behaviors: ['Dialogs', 'Behaviors', tool('sliders-horizontal')],
        timing: ['Dialogs', 'Timing & defaults', tool('timer')],
        'cond-layers': ['Dialogs', 'Conditional layers', tool('layers')],
        autocorrect: ['Dialogs', 'Autocorrect', tool('spell-check')],
        cluster: ['Dialogs', 'Cluster diagnostics', tool('network')],
        node: ['Dialogs', 'Node & cluster', tool('waypoints')],
        link: ['Dialogs', 'Link profile', tool('gauge')],
        builder: ['Builder', 'Keyboard builder', builder],
        'builder-key': [
            'Builder',
            'Builder — key selected',
            [...builder, click(byPrefix('Key PressE'), 700)],
        ],
        'builder-export': [
            'Builder',
            'Export & build',
            [
                ...builder,
                click(
                    () =>
                        buttons().find(
                            (b) => b.textContent.trim() === 'Export & build',
                        ),
                    900,
                ),
            ],
        ],
        deck9: ['Devices', 'Deck 9 macro pad', device('Deck 9')],
        mouse: ['Devices', 'Halo M2 mouse', mouse],
        'mouse-selected': [
            'Devices',
            'Mouse — control selected',
            [
                ...mouse,
                click(
                    () =>
                        buttons().find((b) =>
                            /Left (click|button)/.test(
                                b.getAttribute('aria-label') || b.textContent,
                            ),
                        ),
                    700,
                ),
            ],
        ],
        'mouse-layout': [
            'Devices',
            'Mouse — layout builder',
            [...mouse, click(headerBtn('ruler'), 1200)],
        ],
        'mouse-settings': [
            'Devices',
            'Mouse — device settings',
            [...mouse, click(headerBtn('sliders-horizontal'), 900)],
        ],
        gamepad: ['Devices', 'Vector Pad gamepad', device('Vector Pad')],
        flightstick: [
            'Devices',
            'Apex flight stick',
            device('Apex Flight Stick'),
        ],
        generic: [
            'Devices',
            'Generic USB gamepad',
            device('Generic USB Gamepad'),
        ],
    }

    function reloadInto(screen) {
        sessionStorage.setItem(KEYS.goto, screen)
        location.reload()
    }
    async function runScreen(id) {
        const entry = SCREENS[id]
        if (!entry) return
        setMockPrefs({ screen: id })
        status('Opening ' + entry[1] + '…')
        try {
            await waitFor(
                () =>
                    document.querySelector(
                        '#root header, #root main, #root button',
                    ),
                8000,
            )
            for (const step of entry[2]) await step()
            status('')
        } catch (e) {
            console.error(e)
            status(
                'Could not reach “' +
                    entry[1] +
                    '” — the app layout may have changed.',
            )
        }
        render()
    }

    // ---------- panel ----------
    const host = document.createElement('div')
    host.id = 'remappr-mock-tweaks'
    host.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483000;pointer-events:auto;'
    // Keep Radix dialogs open and their focus traps quiet while the panel is used.
    ;['pointerdown', 'mousedown', 'focusin', 'keydown', 'wheel'].forEach((t) =>
        host.addEventListener(t, (e) => e.stopPropagation()),
    )
    const shadow = host.attachShadow({ mode: 'open' })
    let statusText = ''
    function status(t) {
        statusText = t
        const el = shadow.getElementById('status')
        if (el) el.textContent = t
    }

    const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: var(--font-sans, system-ui, sans-serif); }
.pill { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--popover); color: var(--popover-foreground);
  font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 8px 24px rgb(0 0 0 / .28); }
.pill .dot { width: 8px; height: 8px; border-radius: 99px; background: var(--primary); }
.panel { width: 316px; max-height: min(78vh, 720px); display: flex; flex-direction: column; border-radius: 14px;
  border: 1px solid var(--border); background: var(--popover); color: var(--popover-foreground);
  box-shadow: 0 30px 70px -20px rgb(0 0 0 / .7); overflow: hidden; }
.head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
.mark { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; color: #fff;
  background: linear-gradient(150deg, var(--primary), color-mix(in oklch, var(--primary) 65%, #000)); }
.title { font-size: 13px; font-weight: 700; } .sub { font-size: 10.5px; color: var(--muted-foreground); }
.x { margin-left: auto; width: 28px; height: 28px; border-radius: 8px; border: 1px solid transparent; background: none;
  color: var(--muted-foreground); cursor: pointer; font-size: 16px; line-height: 1; }
.x:hover { background: var(--accent); color: var(--accent-foreground); }
.body { overflow-y: auto; padding: 4px 14px 14px; }
h4 { margin: 14px 0 8px; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted-foreground); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 7px 0; }
.row > span { font-size: 12.5px; font-weight: 500; }
select, input[type=range] { accent-color: var(--primary); }
select { height: 30px; min-width: 150px; border-radius: 8px; border: 1px solid var(--input); background: var(--background);
  color: var(--foreground); font-size: 12px; padding: 0 8px; }
.seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 10px; border: 1px solid var(--border); background: var(--secondary); }
.seg button { border: 0; background: none; padding: 5px 9px; border-radius: 8px; font-size: 11.5px; font-weight: 600;
  color: var(--muted-foreground); cursor: pointer; }
.seg button[aria-pressed=true] { background: var(--background); color: var(--foreground); box-shadow: 0 1px 3px rgb(0 0 0 / .18); }
.sw { position: relative; width: 34px; height: 20px; border-radius: 99px; border: 0; cursor: pointer; background: var(--input); }
.sw[aria-checked=true] { background: var(--primary); }
.sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 99px; background: #fff; transition: transform .15s; }
.sw[aria-checked=true]::after { transform: translateX(14px); }
.swatches { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.swatch { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px; border-radius: 9px;
  border: 1px solid var(--border); background: var(--background); color: var(--foreground); font-size: 10.5px; font-weight: 600; cursor: pointer; }
.swatch[aria-pressed=true] { outline: 2px solid var(--primary); outline-offset: 1px; }
.chip { width: 26px; height: 14px; border-radius: 5px; display: flex; overflow: hidden; border: 1px solid rgb(0 0 0 / .12); }
.chip i { flex: 1; }
.screens { display: flex; flex-direction: column; gap: 2px; }
.screens .grp { font-size: 10.5px; color: var(--muted-foreground); margin: 8px 0 2px; font-weight: 700; }
.screens button { text-align: left; border: 0; background: none; color: var(--foreground); padding: 6px 8px; border-radius: 7px;
  font-size: 12.5px; cursor: pointer; display: flex; justify-content: space-between; }
.screens button:hover { background: var(--accent); }
.screens button[aria-current=true] { background: color-mix(in oklch, var(--primary) 16%, transparent); font-weight: 600; }
.links { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.links a, .btn { font-size: 11.5px; font-weight: 600; padding: 6px 9px; border-radius: 8px; border: 1px solid var(--border);
  color: var(--foreground); background: var(--background); text-decoration: none; cursor: pointer; }
.links a:hover, .btn:hover { background: var(--accent); }
#status { font-size: 11px; color: var(--muted-foreground); min-height: 14px; padding: 6px 14px 10px; border-top: 1px solid var(--border); }
`

    // Swatch colours: each palette's light primary + background (README → Palettes).
    const SWATCH = {
        default: ['oklch(0.48 0.2184 262)', 'oklch(1 0 0)'],
        claude: [
            'oklch(0.6171 0.1375 39.0427)',
            'oklch(0.9818 0.0054 95.0986)',
        ],
        supabase: ['oklch(0.8348 0.1302 160.908)', 'oklch(0.9911 0 0)'],
        't3-chat': [
            'oklch(0.5316 0.1409 355.1999)',
            'oklch(0.9754 0.0084 325.6414)',
        ],
        vercel: ['oklch(0 0 0)', 'oklch(0.99 0 0)'],
        twitter: ['oklch(0.6723 0.1606 244.9955)', 'oklch(1 0 0)'],
        bubblegum: [
            'oklch(0.6209 0.1801 348.1385)',
            'oklch(0.9399 0.0203 345.6985)',
        ],
        catppuccin: [
            'oklch(0.5547 0.2503 297.0156)',
            'oklch(0.9578 0.0058 264.5321)',
        ],
    }

    function seg(id, value, options) {
        return `<div class="seg" role="group">${options
            .map(
                ([v, l]) =>
                    `<button type="button" data-tweak="${id}" data-value="${v}" aria-pressed="${String(v) === String(value)}">${l}</button>`,
            )
            .join('')}</div>`
    }
    function sel(id, value, options) {
        return `<select data-tweak="${id}">${options
            .map(
                ([v, l]) =>
                    `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${l}</option>`,
            )
            .join('')}</select>`
    }
    function sw(id, value) {
        return `<button type="button" class="sw" role="switch" data-tweak="${id}" data-value="${!value}" aria-checked="${value}" aria-label="${id}"></button>`
    }

    function render() {
        const v = current()
        const prefs = mockPrefs()
        if (!prefs.open) {
            shadow.innerHTML = `<style>${CSS}</style><button class="pill" id="open" type="button"><span class="dot"></span>Tweaks</button>`
            shadow.getElementById('open').onclick = () => (
                setMockPrefs({ open: true }),
                render()
            )
            return
        }
        const groups = {}
        Object.entries(SCREENS).forEach(([id, [g, label]]) =>
            (groups[g] = groups[g] || []).push([id, label]),
        )
        shadow.innerHTML = `<style>${CSS}</style>
<div class="panel" role="dialog" aria-label="Mock tweaks">
  <div class="head">
    <span class="mark"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg></span>
    <div><div class="title">Tweaks</div><div class="sub">Remappr mock · real app, demo devices</div></div>
    <button class="x" id="close" type="button" aria-label="Hide tweaks">×</button>
  </div>
  <div class="body">
    <h4>Theme</h4>
    <div class="swatches">${PALETTES.map(([id, label]) => `<button type="button" class="swatch" data-tweak="palette" data-value="${id}" aria-pressed="${v.palette === id}"><span class="chip"><i style="background:${SWATCH[id][0]}"></i><i style="background:${SWATCH[id][1]}"></i></span>${label}</button>`).join('')}</div>
    <div class="row"><span>Mode</span>${seg('mode', v.mode, [
        ['light', 'Light'],
        ['dark', 'Dark'],
        ['system', 'System'],
    ])}</div>

    <h4>Keycaps</h4>
    <div class="row"><span>Cap style</span>${sel('capStyle', v.capStyle, [
        ['sculpted', 'Sculpted'],
        ['flat', 'Flat'],
        ['mono', 'Mono'],
        ['glass', 'Glass'],
    ])}</div>
    <div class="row"><span>Colour-coding</span>${seg('colorMode', v.colorMode, [
        ['off', 'Off'],
        ['subtle', 'Subtle'],
        ['vivid', 'Vivid'],
    ])}</div>
    <div class="row"><span>Key header</span>${sel('keyHeader', v.keyHeader, [
        ['displayName', 'Action name'],
        ['binding', 'Binding code'],
        ['hidden', 'Hidden'],
    ])}</div>

    <h4>Lighting simulation</h4>
    <div class="row"><span>Effect</span>${sel(
        'lightEffect',
        v.lightEffect,
        [
            'solid',
            'breathe',
            'rainbow',
            'swirl',
            'reactive',
            'wave',
            'twinkle',
            'gradient',
            'off',
        ].map((e) => [e, e[0].toUpperCase() + e.slice(1)]),
    )}</div>
    <div class="row"><span>Hue ${v.lightHue}°</span><input type="range" min="0" max="359" value="${v.lightHue}" data-tweak="lightHue"></div>
    <div class="row"><span>Brightness ${v.lightBright}%</span><input type="range" min="0" max="100" value="${v.lightBright}" data-tweak="lightBright"></div>

    <h4>Workspace & start page</h4>
    <div class="row"><span>Workspace</span>${sel('workspace', v.workspace, [
        ['workbench', 'Workbench'],
        ['inspector', 'Inspector'],
        ['command', 'Command'],
    ])}</div>
    <div class="row"><span>News layout</span>${sel('newsStyle', v.newsStyle, [
        ['rail', 'Rail'],
        ['feed', 'Feed'],
        ['spotlight', 'Spotlight'],
        ['banner', 'Banner'],
        ['chip', 'Chip'],
        ['inbox', 'Inbox'],
        ['none', 'Off'],
    ])}</div>
    <div class="row"><span>Pinned news banner</span>${sw('newsPinnedBanner', v.newsPinnedBanner)}</div>
    <div class="row"><span>Auto-save</span>${sw('autosave', v.autosave)}</div>
    <div class="row"><span>Onboarding tours</span>${sw('tours', v.tours)}</div>

    <h4>Screens</h4>
    <div class="screens">${Object.entries(groups)
        .map(
            ([g, items]) =>
                `<div class="grp">${g}</div>` +
                items
                    .map(
                        ([id, label]) =>
                            `<button type="button" data-screen="${id}" aria-current="${prefs.screen === id}">${label}<span aria-hidden="true">→</span></button>`,
                    )
                    .join(''),
        )
        .join('')}</div>

    <h4>Design files</h4>
    <div class="links">
      <a href="https://claude.ai/artifact/X1BseJRvpi9AuoWUrJNoHs" target="_blank" rel="noopener">Design system</a>
      <a href="https://claude.ai/artifact/KkqZLp3KipzTT9H6dTKBFe" target="_blank" rel="noopener">Design canvas</a>
      <a href="../prototypes.html">Old prototypes</a>
      <button class="btn" type="button" id="reset">Reset mock</button>
    </div>
  </div>
  <div id="status" role="status">${statusText}</div>
</div>`
        shadow.getElementById('close').onclick = () => (
            setMockPrefs({ open: false }),
            render()
        )
        shadow.getElementById('reset').onclick = () => {
            ;[
                KEYS.mode,
                KEYS.palette,
                KEYS.settings,
                KEYS.lighting,
                KEYS.coach,
            ].forEach((k) => localStorage.removeItem(k))
            localStorage.setItem(KEYS.coach, '1')
            patchZustand(KEYS.settings, { seenBuilderTour: true })
            reloadInto('start')
        }
        shadow
            .querySelectorAll('[data-screen]')
            .forEach((b) => (b.onclick = () => reloadInto(b.dataset.screen)))
        shadow.querySelectorAll('button[data-tweak]').forEach((b) => {
            b.onclick = () => {
                const raw = b.dataset.value
                setTweak(
                    b.dataset.tweak,
                    raw === 'true' ? true : raw === 'false' ? false : raw,
                )
            }
        })
        shadow
            .querySelectorAll('select[data-tweak]')
            .forEach(
                (s) => (s.onchange = () => setTweak(s.dataset.tweak, s.value)),
            )
        shadow
            .querySelectorAll('input[type=range][data-tweak]')
            .forEach(
                (r) => (r.onchange = () => setTweak(r.dataset.tweak, r.value)),
            )
    }

    // First visit: tours off so screens open clean (the Tweaks panel turns them back on).
    if (!readJson(KEYS.mock)) {
        localStorage.setItem(KEYS.coach, '1')
        patchZustand(KEYS.settings, { seenBuilderTour: true })
        setMockPrefs({ open: true, screen: 'start' })
    }

    function boot() {
        document.body.appendChild(host)
        render()
        const target = sessionStorage.getItem(KEYS.goto)
        sessionStorage.removeItem(KEYS.goto)
        if (target && target !== 'start') {
            runScreen(target)
            return
        }
        setMockPrefs({ screen: 'start' })
        render()
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', boot)
    else boot()
})()
