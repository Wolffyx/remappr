// Shared Vite `resolve.dedupe` list for both vite.config.ts (web) and
// electron.vite.config.ts. The @remappr/* sibling repos (ui, builder) are
// symlinked into src/ and ship their own node_modules with slightly different
// dep versions. Without dedupe, Vite resolves symlinks to realpath and loads a
// SECOND copy of React/zustand/etc from the sibling's node_modules — breaking
// React context (sidebar, dialogs) and zustand store identity (builder).
export const remapprDedupe = [
    'react',
    'react-dom',
    'zustand',
    'react-aria-components',
    'cmdk',
    'sonner',
    'embla-carousel-react',
    '@radix-ui/react-checkbox',
    '@radix-ui/react-collapsible',
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-label',
    '@radix-ui/react-popover',
    '@radix-ui/react-radio-group',
    '@radix-ui/react-scroll-area',
    '@radix-ui/react-select',
    '@radix-ui/react-separator',
    '@radix-ui/react-slot',
    '@radix-ui/react-switch',
    '@radix-ui/react-tabs',
    '@radix-ui/react-toggle',
    '@radix-ui/react-toggle-group',
    '@radix-ui/react-tooltip',
]
