# Changelog

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
