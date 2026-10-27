/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
    /** Supabase project URL. Unset → no cloud (local-only build). */
    readonly VITE_SUPABASE_URL?: string
    /** Supabase publishable (public) key. Unset → no cloud. */
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
    /** Site hosting auth/desktop.html for desktop OAuth. Default: remappr.com
     *  (localhost:5173 in dev). */
    readonly VITE_AUTH_SITE_URL?: string
    /** <PREFIX>_AUTH_SITE_URL from .env.local: wins over everything. */
    readonly VITE_AUTH_SITE_OVERRIDE?: string
    /** "delivered": load the builder from get-package instead of the bundle. */
    readonly VITE_BUILDER_SOURCE?: string
}

declare namespace React {
    interface CSSProperties {
        WebkitAppRegion?: 'drag' | 'no-drag'
    }
}
