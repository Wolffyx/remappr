/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
    /** Supabase project URL. Unset → no cloud (local-only build). */
    readonly VITE_SUPABASE_URL?: string
    /** Supabase publishable (public) key. Unset → no cloud. */
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

declare namespace React {
    interface CSSProperties {
        WebkitAppRegion?: 'drag' | 'no-drag'
    }
}
