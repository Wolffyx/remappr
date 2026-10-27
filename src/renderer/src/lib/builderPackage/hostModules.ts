// pattern-check: skip — the host's module table for the builder package (data).
//
// Everything the builder package imports but does not bundle, provided by this
// app at runtime (see loader.ts). Each entry is a lazy import, so nothing here
// lands in the entry chunk. A package whose manifest needs a module missing
// from this table is not loaded (hostModules.test.ts keeps it in sync with the
// builder's sources).

/** Bumped when a module here changes in a way old packages would break on. */
export const HOST_API = 1

export const HOST_MODULES: Readonly<Record<string, () => Promise<unknown>>> = {
    '@/components/modals/ExportPanel': () =>
        import('@/components/modals/ExportPanel'),
    '@/components/modals/Settings': () =>
        import('@/components/modals/Settings'),
    '@/features/actions/KeyActionPicker': () =>
        import('@/features/actions/KeyActionPicker'),
    '@/features/device/MouseSettingsPanel': () =>
        import('@/features/device/MouseSettingsPanel'),
    '@/features/device/PowerSection': () =>
        import('@/features/device/PowerSection'),
    '@/features/devices/formIcons': () =>
        import('@/features/devices/formIcons'),
    '@/features/devices/layout/LayoutPanels': () =>
        import('@/features/devices/layout/LayoutPanels'),
    '@/features/devices/layout/LayoutStage': () =>
        import('@/features/devices/layout/LayoutStage'),
    '@/features/devices/model/deviceBuilderStore': () =>
        import('@/features/devices/model/deviceBuilderStore'),
    '@/features/devices/stage/ControlShape': () =>
        import('@/features/devices/stage/ControlShape'),
    '@/features/keymap/keyboard/KeyButton': () =>
        import('@/features/keymap/keyboard/KeyButton'),
    '@/features/keymap/keyboard/SliderCap': () =>
        import('@/features/keymap/keyboard/SliderCap'),
    '@/features/keymap/keyboard/ZoomHud': () =>
        import('@/features/keymap/keyboard/ZoomHud'),
    '@/features/library/LibraryModal': () =>
        import('@/features/library/LibraryModal'),
    '@/features/lighting/engine': () => import('@/features/lighting/engine'),
    '@/features/sliders/model': () => import('@/features/sliders/model'),
    '@/hooks/use-dark-mode': () => import('@/hooks/use-dark-mode'),
    '@/hooks/use-premium': () => import('@/hooks/use-premium'),
    '@/layout/TrafficLightInset': () => import('@/layout/TrafficLightInset'),
    '@/layout/WindowControls': () => import('@/layout/WindowControls'),
    '@/lib/actions/hidUsages': () => import('@/lib/actions/hidUsages'),
    '@/lib/clampInt': () => import('@/lib/clampInt'),
    '@/lib/cn': () => import('@/lib/cn'),
    '@/lib/devices/labels': () => import('@/lib/devices/labels'),
    '@/lib/devices/layoutOps': () => import('@/lib/devices/layoutOps'),
    '@/lib/keymap/keyCategory': () => import('@/lib/keymap/keyCategory'),
    '@/lib/library/entries': () => import('@/lib/library/entries'),
    '@/lib/monaco': () => import('@/lib/monaco'),
    '@/lib/scalePosition': () => import('@/lib/scalePosition'),
    '@/stores/builderStore': () => import('@/stores/builderStore'),
    '@/stores/configStore': () => import('@/stores/configStore'),
    '@/stores/connectionStore': () => import('@/stores/connectionStore'),
    '@/stores/libraryStore': () => import('@/stores/libraryStore'),
    '@/stores/userSettingsStore': () => import('@/stores/userSettingsStore'),
    '@/ui/app-select': () => import('@/ui/app-select'),
    '@/ui/badge': () => import('@/ui/badge'),
    '@/ui/button': () => import('@/ui/button'),
    '@/ui/command': () => import('@/ui/command'),
    '@/ui/dropdown-menu': () => import('@/ui/dropdown-menu'),
    '@/ui/input': () => import('@/ui/input'),
    '@/ui/learn-more': () => import('@/ui/learn-more'),
    '@/ui/modal': () => import('@/ui/modal'),
    '@/ui/named-id': () => import('@/ui/named-id'),
    '@/ui/number-input': () => import('@/ui/number-input'),
    '@/ui/popover': () => import('@/ui/popover'),
    '@/ui/section-label': () => import('@/ui/section-label'),
    '@/ui/segmented': () => import('@/ui/segmented'),
    '@/ui/switch': () => import('@/ui/switch'),
    '@/ui/switch-row': () => import('@/ui/switch-row'),
    '@/ui/tabs': () => import('@/ui/tabs'),
    '@/ui/tooltip': () => import('@/ui/tooltip'),
    '@firmware/catalog/pages': () => import('@firmware/catalog/pages'),
    '@firmware/clients/mock/codec': () =>
        import('@firmware/clients/mock/codec'),
    '@firmware/clients/qmk/codec': () => import('@firmware/clients/qmk/codec'),
    '@firmware/clients/zmk/codec': () => import('@firmware/clients/zmk/codec'),
    '@firmware/clients/zmk/paramLabel': () =>
        import('@firmware/clients/zmk/paramLabel'),
    '@firmware/config': () => import('@firmware/config'),
    '@firmware/devices': () => import('@firmware/devices'),
    '@firmware/devices/defaultLayout': () =>
        import('@firmware/devices/defaultLayout'),
    '@firmware/devices/schema': () => import('@firmware/devices/schema'),
    '@firmware/devices/stockLayouts': () =>
        import('@firmware/devices/stockLayouts'),
    '@firmware/devices/variants': () => import('@firmware/devices/variants'),
    '@firmware/mouseCommands': () => import('@firmware/mouseCommands'),
    '@monaco-editor/react': () => import('@monaco-editor/react'),
    'lucide-react': () => import('lucide-react'),
    react: () => import('react'),
    'react/jsx-runtime': () => import('react/jsx-runtime'),
    sonner: () => import('sonner'),
}
