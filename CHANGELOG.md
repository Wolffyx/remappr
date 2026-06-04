# Changelog

## [1.5.0](https://github.com/Wolffyx/remappr/compare/v1.4.0...v1.5.0) (2026-06-04)


### Features

* **build:** cloud-build hardening — head_sha polling + encrypted token (phase 9) ([fa640c5](https://github.com/Wolffyx/remappr/commit/fa640c5df4284519d400758bec71b237908eff13))
* **builder:** canvas editing — drag/resize/rotate/marquee + undo/redo (phase 3) ([fd0fa9e](https://github.com/Wolffyx/remappr/commit/fd0fa9e33f70f6d3ce513f90a29608ca0bf397f2))
* **builder:** design a board from scratch (grid geometry) ([c261455](https://github.com/Wolffyx/remappr/commit/c26145530bd5faf1b3e185a103584e1abac16b2b))
* **builder:** edit encoder cw/ccw/press bindings in the inspector ([2b10237](https://github.com/Wolffyx/remappr/commit/2b10237cdae48eb4417ef859474944f468739973))
* **builder:** editable matrix GPIO pins + add row/column ([a498117](https://github.com/Wolffyx/remappr/commit/a498117666e3c18ffa5b147fa4d6b57eed756de4))
* **builder:** export modal + board library + editor handoff (phase 6) ([71cb5c3](https://github.com/Wolffyx/remappr/commit/71cb5c32535bcc3884e6453fbcfd79fbc14853d5))
* **builder:** firmware-aware deviceless binding picker ([3067a95](https://github.com/Wolffyx/remappr/commit/3067a95db89971da4aba99d921cc54e58ea656a9))
* **builder:** free-form per-key geometry editor ([59f2256](https://github.com/Wolffyx/remappr/commit/59f225634ad5692f0d1322c0c4a63842d1ed57cb))
* **builder:** full-screen shell + start-page restyle (phase 1) ([ea842b2](https://github.com/Wolffyx/remappr/commit/ea842b204006a878eaa856ccbb80d211ce5ad728))
* **builder:** hardware definition panel (board + kscan wiring) ([5038ca2](https://github.com/Wolffyx/remappr/commit/5038ca23d2955ab674f9b5c88e0c7d0b5a364196))
* **builder:** inspector parity, cap rendering, per-key GPIO pin + element ([882fdf0](https://github.com/Wolffyx/remappr/commit/882fdf0fe6b8ec87ff9ddb6d10c30b83156c0527))
* **builder:** left panel — layers, identity/firmware/matrix/lighting, presets (phase 4) ([1deda68](https://github.com/Wolffyx/remappr/commit/1deda680e90acfdfc6deb990d5575dd77e5e4f4c))
* **builder:** live Monaco JSON config panel (phase 8) ([0034b1f](https://github.com/Wolffyx/remappr/commit/0034b1fa8db80121445367ac874906db7535e8c1))
* **builder:** Phase 1 — download full project bundle (.zip) ([a610111](https://github.com/Wolffyx/remappr/commit/a6101116cc3f3e96f1025586a0decaa9175e843e))
* **builder:** Phase 1 cloud build — push to GitHub & fetch firmware ([758a4d8](https://github.com/Wolffyx/remappr/commit/758a4d8a21ae73b0a6d8688d31375c794d5c4aad))
* **builder:** pixel-drag handles + encoder placement ([f8c686e](https://github.com/Wolffyx/remappr/commit/f8c686e17104b524b27833f7dc700349111d96ae))
* **builder:** premium entitlement gate + locked build-from-scratch entry ([c54c700](https://github.com/Wolffyx/remappr/commit/c54c7003f3e55becf5cc2e032a71df02b810dbe8))
* **builder:** right inspector + matrix overlay + variants (phase 5) ([5867d9e](https://github.com/Wolffyx/remappr/commit/5867d9ecd792776ab9000d5e9da1b1af3c6f2387))
* **builder:** snapping toggle, in-builder settings, start chooser ([42cb05b](https://github.com/Wolffyx/remappr/commit/42cb05b7435d9202d02a19f73d76751e8b1fcc09))
* **builder:** visible JSON validation status + searchable All-options ([f373a4d](https://github.com/Wolffyx/remappr/commit/f373a4da49920ecf831de3ac6be81b8d75f6d43e))
* **config:** board hardware → real ZMK kscan + electrical transform ([392150c](https://github.com/Wolffyx/remappr/commit/392150c702dd3a435305130424b051493738a065))
* **config:** builder metadata schema fields (phase 2) ([caf1650](https://github.com/Wolffyx/remappr/commit/caf165059112e47d6c11a8b256189203d64072f9))
* **config:** conditional layers in keymap schema ([76bd706](https://github.com/Wolffyx/remappr/commit/76bd706f5f49071305be7b61beedac098a06fc4d))
* **config:** config store, live edit-sync, and target-aware Download modal ([7dd9821](https://github.com/Wolffyx/remappr/commit/7dd9821c66605ab18bd6d65132ffc678af91d88f))
* **config:** custom hold-tap behaviors (flavor + definition nodes) ([c0be667](https://github.com/Wolffyx/remappr/commit/c0be6676a1057fc176af05eb0ff91ab286e8e6fc))
* **config:** extend ZMK behavior coverage (enum tails, 2-param macros, mod-morph) ([6d5be92](https://github.com/Wolffyx/remappr/commit/6d5be9269524d781257bf47a30eee1d8b1a27c79))
* **config:** generalized remappr keymap schema + keycode/diagnostics layer ([ad74a7a](https://github.com/Wolffyx/remappr/commit/ad74a7a70eab4c1e88cb378df8ba7ffeaf9db360))
* **config:** JSON keymap source-of-truth, lower/raise bridge, ZMK overlay + parity ([7eb418c](https://github.com/Wolffyx/remappr/commit/7eb418ca4815dd66d81441ef90e03073bdd3d5bd))
* **config:** per-firmware keymap compiler (ZMK / QMK / Keychron) ([149e92e](https://github.com/Wolffyx/remappr/commit/149e92efa7ea0ea6ab3c91a31f129d177e4ef1c4))
* **config:** per-key encoder bindings + pin/element metadata ([b7e7801](https://github.com/Wolffyx/remappr/commit/b7e7801dd2795737ec301038213e471526097633))
* **config:** raise connected ZMK keymap into remappr config ([e579be6](https://github.com/Wolffyx/remappr/commit/e579be62479c0137f78cc0458a065e42f2a5db45))
* **config:** value-carrying lighting (RGB_COLOR_HSB + BL_SET) ([908054f](https://github.com/Wolffyx/remappr/commit/908054f1158b46e261749cc2d385bae81bb9c569))
* **entitlements:** dev-build bypass for premium (builder access) ([0f85347](https://github.com/Wolffyx/remappr/commit/0f85347e7ae84b234bcfae6df7a3ad096c07511b))
* **firmware:** resolve friendly pin labels to flashable kscan/config.h ([c9adaad](https://github.com/Wolffyx/remappr/commit/c9adaadfd1a8834010b07f1818efeb93a0c1f1e5))
* **keycap:** unified RKey keycap anatomy with chord chips ([782f21a](https://github.com/Wolffyx/remappr/commit/782f21aec4a27518e165abaf19bc1f230cf807d2))
* **qmk:** generate encoder_map + firmware-aware builder binding codes ([f743e06](https://github.com/Wolffyx/remappr/commit/f743e06969fb193bc4c9a6e8434c899dd448c1eb))
* **zmk:** emit sensor-bindings from per-key encoderBindings ([6729f2b](https://github.com/Wolffyx/remappr/commit/6729f2bd1f347fa34822696db28375abedbf9a00))
* **zmk:** matrix-transform overlay, hardware checklist, conditional layers, encoders ([ff55840](https://github.com/Wolffyx/remappr/commit/ff558401e8d9fb27d5adcaf85a78ad248510daf9))


### Bug Fixes

* **builder:** expose firmware export for from-scratch boards ([9918c22](https://github.com/Wolffyx/remappr/commit/9918c2228577b1422519a35d0f4b4fec3190a43a))
* **builder:** refresh library list when the modal opens ([c16e97f](https://github.com/Wolffyx/remappr/commit/c16e97fbcf48f5102c6b9bb4cf70bac4e73d2fdc))
* **builder:** render transparent caps + honor Key Header binding-code mode ([6cb476d](https://github.com/Wolffyx/remappr/commit/6cb476d6a12fab646bb8d70325fc0834a3732ffc))
* **builder:** split+stagger-aware matrix wiring, scrollbar, split divider ([cbde520](https://github.com/Wolffyx/remappr/commit/cbde520fe8f2258fa092bed3d8551b1706698a5c))

## [1.4.0](https://github.com/Wolffyx/remappr/compare/v1.3.0...v1.4.0) (2026-06-02)


### Features

* **canvas:** pannable/zoomable stage, press-count heatmap, key tooltips ([4e2327f](https://github.com/Wolffyx/remappr/commit/4e2327f96879fe70859e6adde7ebb971e91e036a))
* **dialogs,zoom:** redesign dialogs and fixed zoom ([9d0b3f2](https://github.com/Wolffyx/remappr/commit/9d0b3f2a409b8f782f60586ce46741ebe0f5a46f))
* **editor:** multi-select, layer peek, toolbar grouping, shortcuts ([29bc2ea](https://github.com/Wolffyx/remappr/commit/29bc2ea8db724ee9815f97b41e670cadebe60c3a))
* feat(): added discord server and docs icon ([7a6c27a](https://github.com/Wolffyx/remappr/commit/7a6c27a650e40fde0b3e2ab2eeafce2652728bca))
* **keycap:** changed the keycap design and added styles ([cd24242](https://github.com/Wolffyx/remappr/commit/cd242420d874353986f078a875d3c37c30e4d06a))
* **keycaps:** colour-coded keycap system + cap-style/colour settings ([1c28a48](https://github.com/Wolffyx/remappr/commit/1c28a48a15a3552511862301465d8df422c223a8))
* **modals:** typing-load stats, onboarding coachmarks, start-page preview ([3992e90](https://github.com/Wolffyx/remappr/commit/3992e904d19d4c89e2d6c1f7ddd8f1cdf48e5dc4))
* **start-page:** real cached keyboard preview on device cards ([39feebb](https://github.com/Wolffyx/remappr/commit/39feebbf1b930a05c2474fb65cc005867676e4db))
* **workspaces:** inspector + command-palette assign surfaces, tap-hold builder ([e68c276](https://github.com/Wolffyx/remappr/commit/e68c2762d62333fc0792737cfdb71c3e831bfbc5))


### Bug Fixes

* **zoom, theme:** fixed zoom system and theme system ([67fa5ac](https://github.com/Wolffyx/remappr/commit/67fa5ac17ec30e707edb53da96474eaeb8b4ae53))

## [1.3.0](https://github.com/Wolffyx/remappr/compare/v1.2.0...v1.3.0) (2026-05-15)


### Features

* **catalog:** add 7 QMK swap-hands variants as Misc tiles ([85b044b](https://github.com/Wolffyx/remappr/commit/85b044b5f7775b183ac4ea343ca471d88be2b283))
* **catalog:** add Combos tab; drop vial:macro from action picker ([2c73dfb](https://github.com/Wolffyx/remappr/commit/2c73dfb7be6a4a705ff1f52ef05377651e45c5c4))
* **catalog:** add dynamicCatalogStore + behavior capability flags ([00d4db0](https://github.com/Wolffyx/remappr/commit/00d4db06937e00c60b515a004041f0ed6d515ec3))
* **catalog:** gate behavior-family tiles by Capabilities.behaviors flags ([fc79fff](https://github.com/Wolffyx/remappr/commit/fc79fff301e029e92872a3b4b790b279cfeabc50))
* **catalog:** merge RGB + Backlight into single Lighting tab ([0076123](https://github.com/Wolffyx/remappr/commit/0076123389e32febd79b2976fc3be234d360170e))
* **catalog:** plumb macro overlay description into picker tooltip ([6a98b8a](https://github.com/Wolffyx/remappr/commit/6a98b8adae89deae412fb50495cff9e6ca1d4479))
* **catalog:** sideload ZMK .keymap combos as display-only Combos tiles ([8041fc9](https://github.com/Wolffyx/remappr/commit/8041fc97627979924a128cb582006fc50b86907e))
* **catalog:** surface ZMK runtime macros/combos as catalog tiles ([051b183](https://github.com/Wolffyx/remappr/commit/051b1837e6e1a2a0ba517f36682edc9c52636f14))
* **editor:** inline tap-dance editor modal from BindingEditor ([c8bdc5e](https://github.com/Wolffyx/remappr/commit/c8bdc5ec4a68eec470be80b33ad9cf60deeae1d1))
* **keymap:** right-click copy/paste on bound keys ([4e5a5cb](https://github.com/Wolffyx/remappr/commit/4e5a5cb1ea6d579c8dc1ef086989acadbf020168))
* **picker:** seed modifier/enum slot defaults from first listed value ([9f5483e](https://github.com/Wolffyx/remappr/commit/9f5483e245d73a43a69c8234f56bdbb04e2025b9))
* **zmk-export:** cover all behaviors from ZMK docs index page ([03d45b5](https://github.com/Wolffyx/remappr/commit/03d45b53be3bd03a8c80a3fd392573b556a64c3b))
* **zmk-export:** cover all behaviors from ZMK docs index page ([1b35381](https://github.com/Wolffyx/remappr/commit/1b3538106209455060a9fe0b3bc5c82fb9e7e5f1))


### Bug Fixes

* **catalog:** classify any non-system ZMK behavior as user macro ([90feaec](https://github.com/Wolffyx/remappr/commit/90feaec4e30f6eeb17c865e760a48290e40b7cca))
* **catalog:** keep slot-bearing ZMK behaviors out of Macros tab ([7846cf1](https://github.com/Wolffyx/remappr/commit/7846cf13b49b760b4932a97ce60f04f77556df09))
* commented import combos side loading ([854b794](https://github.com/Wolffyx/remappr/commit/854b794421a5014a914ba4fef13992d5300c355e))

## [1.2.0](https://github.com/Wolffyx/remappr/compare/v1.1.0...v1.2.0) (2026-05-06)


### Features

* **catalog:** clarify Locking/Keypad labels and split Language tab ([9490b72](https://github.com/Wolffyx/remappr/commit/9490b723a7caf9eaa8d26fade3c925d0e156820d))
* **catalog:** combine ZMK + QMK keycode names into one canonical catalog ([18a8163](https://github.com/Wolffyx/remappr/commit/18a81637e8886cd32ccf02983025ef981c6e181d))
* **catalog:** merge ZMK + QMK keycode names into one canonical catalog ([b7458ca](https://github.com/Wolffyx/remappr/commit/b7458cafff92d14131dc80821d70b98b907ae41d))

## [1.1.0](https://github.com/Wolffyx/remappr/compare/v1.0.0...v1.1.0) (2026-05-05)


### Features

* adding more security to the project and updated readme and notice ([d84f1d0](https://github.com/Wolffyx/remappr/commit/d84f1d00bbfec7a34099441ea9913c9039c25067))
* **firmware/mock:** wire encoders/dynamic/macros sub-bundle stubs ([c3b129d](https://github.com/Wolffyx/remappr/commit/c3b129d83229dcc8d4a101c7823a9d2faa825324))
* **firmware/qmk-via:** add VIA HID adapter ([d6d5c9f](https://github.com/Wolffyx/remappr/commit/d6d5c9f4db0b1b0247d87b9377cd912c2686e5e1))
* **firmware/qmk-vial:** add Vial adapter v2 ([e15fe33](https://github.com/Wolffyx/remappr/commit/e15fe335ac42d3e7566d87eaee563188f67e0bfc))
* **firmware/qmk-vial:** add Vial adapter with on-device def + lock + encoders + dynamic entries ([87c7b7c](https://github.com/Wolffyx/remappr/commit/87c7b7c45d61e4c908e66f4c3282f6af8e9022a9))
* **firmware/qmk-vial:** macro V2 codec + MacroEditor UI ([7413a57](https://github.com/Wolffyx/remappr/commit/7413a57f7b943ea2a817089948639430bd6631e4))
* **firmware/qmk-vial:** wire dynamic entries through facade + UI editor ([8ef89dd](https://github.com/Wolffyx/remappr/commit/8ef89dd22c37cf0594955de81bd7da885843183d))
* **firmware/qmk-via:** scaffold QMK/VIA adapter stub ([b419a11](https://github.com/Wolffyx/remappr/commit/b419a11fd177cd9ae7e20eed8a4e7e75ce71d2b1))
* **firmware/ui:** add FeatureGate wrapper, replace Header capability checks ([ce7f458](https://github.com/Wolffyx/remappr/commit/ce7f458c152be69330996ad7deead4e363eb52ba))
* **firmware/ui:** collapse lock state to App shell with LockedOverlay ([634553c](https://github.com/Wolffyx/remappr/commit/634553c5277434a9054cd72a9bf487a5ee4bb096))
* **firmware/ui:** gate UnlockModal on capabilities + render/edit encoders ([22438d1](https://github.com/Wolffyx/remappr/commit/22438d1f34988bc62d1f44350e220e79ca30f40d))
* **firmware/ui:** scope keyDisplayMode per firmware id ([b45ded6](https://github.com/Wolffyx/remappr/commit/b45ded69d8b259b9c59bcd254767da8dd42f89bc))
* **firmware/ui:** strip ZMK branding from public-facing UI ([b8e0e5a](https://github.com/Wolffyx/remappr/commit/b8e0e5aaf311a2e8c98e042065bf2e84f9de0515))
* **firmware:** add mock adapter and adapter contract test suite ([3f34118](https://github.com/Wolffyx/remappr/commit/3f341188a23e07d5bffca6dd3461319a0bc9e964))
* **firmware:** add ZmkKeyboardService + ZmkAdapter and register ([6ee5308](https://github.com/Wolffyx/remappr/commit/6ee53086c6ff3384db3add831be3087bfb07765e))
* **firmware:** Added multiple frameworks support ([fd0123a](https://github.com/Wolffyx/remappr/commit/fd0123ab78e8f1e5bea284dffdea053731309e8d))
* **firmware:** connectDevice constructs ZmkKeyboardService and stores it ([060ce6f](https://github.com/Wolffyx/remappr/commit/060ce6f834367ec865561fba8608dbeecc45b081))
* unified behavior picker ([1b0d874](https://github.com/Wolffyx/remappr/commit/1b0d874c6a37157f6c35211846b0e2afb7a88a56))


### Bug Fixes

* **firmware/catalog:** dedup duplicate keycodes via canonical alias map ([53bef47](https://github.com/Wolffyx/remappr/commit/53bef47a979d5c01b0553dcf62c8066af5a45930))
* **firmware/zmk:** release transport stream locks on disconnect + reuse probe RpcConnection ([7e06566](https://github.com/Wolffyx/remappr/commit/7e0656660b6afb483bb8b505891bb63311f7f672))
* **firmware:** sync ZmkKeyboardService cachedKeymap on layer mutations ([88c303a](https://github.com/Wolffyx/remappr/commit/88c303add51493cf18cae3d3cce30db2f9964ff5))
* fix keyboard design ([d037022](https://github.com/Wolffyx/remappr/commit/d037022c67581436c8d2903f4c756537f89141a7))
* fix modifier selection ([4b2acf9](https://github.com/Wolffyx/remappr/commit/4b2acf9c6a7ce2155d6234826d4a0cc6d0733f07))
* persist keyboard name on click-connect and unblock release workflow ([0317610](https://github.com/Wolffyx/remappr/commit/0317610c6ed9cd46bafcb48ee72bd7c7c669c41c))
* persist keyboard name on click-connect and unblock release workflow ([3231f2a](https://github.com/Wolffyx/remappr/commit/3231f2ab4671031e98035e05429228423478a9c8))
* **picker:** include actionTypes in dispatch useCallback deps ([c172ea9](https://github.com/Wolffyx/remappr/commit/c172ea9b9bee5169de04c55a5b6c5705cf888750))
* **picker:** validate slot values + smarter auto-advance for hold-tap ([50d3acd](https://github.com/Wolffyx/remappr/commit/50d3acd483ab3acad231e02e290cf461011ef304))
* removed ai folder ([3750fa0](https://github.com/Wolffyx/remappr/commit/3750fa0538d8b6303d83527de134cdab919766c3))
* removed changelog.md ([be6ace2](https://github.com/Wolffyx/remappr/commit/be6ace2ab0b179e218de6cfe1be35f942a50b9d9))
