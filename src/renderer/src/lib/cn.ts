// Pattern check: no GoF pattern (-) — rejected — config tweak so tailwind-merge knows the design-system font-size tokens.
import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The design-system type scale (index.css @theme --text-*). Without this,
// tailwind-merge reads e.g. `text-control` as a text colour and drops it when
// a real colour such as `text-foreground` follows.
const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            text: [
                'hero',
                'title-xl',
                'title-lg',
                'title',
                'brand',
                'panel-title',
                'control',
                'caption',
                'meta',
            ],
        },
    },
})

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs))
}
