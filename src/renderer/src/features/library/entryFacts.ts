// pattern-check: skip — pure formatting helpers moved out of LibraryModal.
//
// The facts line under a library entry's name, shared by the list and the
// sync dialogs.
import type { DeviceForm } from '@firmware/devices/types'
import { FORM_LABEL } from '@/lib/devices/labels'
import type { LibrarySummary } from '@/lib/library/types'

export function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function fmtDate(ms: number): string {
    return new Date(ms).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

/** "Mouse · 42 keys · 4 layers", plus the date when given. */
export function summaryFacts(
    summary: LibrarySummary,
    updatedAt?: number,
): string {
    const { keys, controls, layers, form } = summary
    const parts = [
        form ? FORM_LABEL[form as DeviceForm] : undefined,
        keys !== undefined ? plural(keys, 'key') : undefined,
        controls !== undefined ? plural(controls, 'control') : undefined,
        layers !== undefined ? plural(layers, 'layer') : undefined,
        updatedAt !== undefined ? fmtDate(updatedAt) : undefined,
    ]
    return parts.filter(Boolean).join(' · ')
}
