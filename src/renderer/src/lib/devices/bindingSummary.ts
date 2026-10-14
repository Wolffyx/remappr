// Pattern check: Dispatch Map (Tier 0) — applied — one summary formatter per control kind, keyed by kind; adding a kind adds an entry.
//
// The one-line reading of a control's binding — what the callout, the control
// list and the info bar show — plus the category that colours it. Labels and
// categories come from the adapter's catalog.
import type {
    ActionId,
    BindingByKind,
    ControlKind,
    ControlsCatalog,
    DeviceActionCategory,
    DeviceControl,
    DeviceBindings,
    ControlBinding,
} from '@firmware/devices/types'
import { bindingOf } from '@firmware/devices/defaults'
import { CURVE_LABEL, TRIGGER_MODE_LABEL } from './labels'
import { supportsField } from './sections'

export interface BindingSummary {
    text: string
    sub?: string
    cat: DeviceActionCategory
}

/** Fast lookups over a catalog, built once per catalog. */
export interface CatalogIndex {
    readonly catalog: ControlsCatalog
    action(id: ActionId | null | undefined): {
        label: string
        cat: DeviceActionCategory
    }
    output(
        kind: 'stick' | 'trigger' | 'axis',
        id: string,
    ): { label: string; cat: DeviceActionCategory }
}

export function indexCatalog(catalog: ControlsCatalog): CatalogIndex {
    const actions = new Map(catalog.actions.map((a) => [a.id, a]))
    return {
        catalog,
        action: (id) => {
            if (id == null) return { label: 'Disabled', cat: 'none' }
            const a = actions.get(id)
            return a
                ? { label: a.label, cat: a.category }
                : { label: id, cat: 'key' }
        },
        output: (kind, id) => {
            const o = catalog.outputs[kind]?.find((x) => x.id === id)
            return { label: o?.label ?? id, cat: o?.category ?? 'pad' }
        },
    }
}

type Formatters = {
    readonly [K in ControlKind]: (
        b: BindingByKind[K],
        ix: CatalogIndex,
    ) => BindingSummary
}

const FORMAT: Formatters = {
    button: (b, ix) => {
        const a = ix.action(b.a)
        const sub = b.hold
            ? `hold · ${ix.action(b.hold).label}`
            : b.turbo
              ? 'turbo'
              : undefined
        return { text: a.label, sub, cat: a.cat }
    },
    wheel: (b, ix) => ({
        text: supportsField(ix.catalog.fields, 'wheel', 'lines')
            ? `Scroll · ${b.lines} lines`
            : 'Scroll wheel',
        sub: `click · ${ix.action(b.click).label}`,
        cat: 'mouse',
    }),
    stick: (b, ix) => {
        const o = ix.output('stick', b.out)
        return {
            text: o.label,
            sub: `${CURVE_LABEL[b.curve]} · dz ${b.inner}%`,
            cat: o.cat,
        }
    },
    trigger: (b, ix) => {
        const o = ix.output('trigger', b.out)
        return {
            text: o.label,
            sub: `${TRIGGER_MODE_LABEL[b.mode]} · ${b.start}–${b.end}%`,
            cat: o.cat,
        }
    },
    hat: (b, ix) => {
        const up = ix.action(b.up)
        return { text: `${b.ways}-way · ${up.label}`, cat: up.cat }
    },
    sensor: (b) => ({
        text: `${b.stages[b.active] ?? b.stages[0] ?? 0} DPI`,
        sub: `${b.poll} Hz`,
        cat: 'mouse',
    }),
    encoder: (b, ix) => {
        const cw = ix.action(b.cw)
        return {
            text: `${cw.label} / ${ix.action(b.ccw).label}`,
            sub: `press · ${ix.action(b.press).label}`,
            cat: cw.cat,
        }
    },
    axis: (b, ix) => {
        const o = ix.output('axis', b.out)
        return {
            text: o.label,
            sub: CURVE_LABEL[b.curve] + (b.inv ? ' · inverted' : ''),
            cat: o.cat,
        }
    },
}

/** Summarise `binding` as a `control.kind` binding. */
export function summarizeBinding(
    control: DeviceControl,
    binding: ControlBinding,
    ix: CatalogIndex,
): BindingSummary {
    const format = FORMAT[control.kind] as (
        b: ControlBinding,
        ix: CatalogIndex,
    ) => BindingSummary
    return format(binding, ix)
}

/** Summarise `control`'s binding in `bindings` (its kind default when unset). */
export function bindingSummary(
    control: DeviceControl,
    bindings: DeviceBindings,
    ix: CatalogIndex,
): BindingSummary {
    return summarizeBinding(
        control,
        bindingOf(control, bindings, ix.catalog),
        ix,
    )
}
