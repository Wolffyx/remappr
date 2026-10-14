// Pattern check: no GoF pattern (-) — rejected — small presentational building blocks of the control inspector (section, action chip, output grid, switch row, live tag).
import type { JSX, ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { ActionId, ControlOption } from '@firmware/devices/types'
import { Switch } from '@/ui/switch'
import { cn } from '@/lib/cn'
import type { CatalogIndex } from '@/lib/devices/bindingSummary'
import {
    categoryAccent,
    DEVICE_CATEGORY_META,
} from '@/lib/devices/deviceCategory'

export function InSection({
    label,
    right,
    children,
}: {
    label: string
    right?: ReactNode
    children: ReactNode
}): JSX.Element {
    return (
        <section className="border-t border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-[.08em] text-muted-foreground uppercase">
                    {label}
                </span>
                {right}
            </div>
            {children}
        </section>
    )
}

/** The pulsing green LIVE tag of a section reading live input. */
export function LiveTag(): JSX.Element {
    return (
        <span className="inline-flex items-center gap-[5px] text-[10.5px] font-bold tracking-[.05em] text-green-600 dark:text-green-400">
            <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
            </span>
            LIVE
        </span>
    )
}

/** An action slot: what is bound, its category, opens the picker on click. */
export function ActionChip({
    slot,
    value,
    ix,
    disabled,
    onClick,
    onClear,
}: {
    slot?: string
    value: ActionId | null | undefined
    ix: CatalogIndex
    disabled?: boolean
    onClick: () => void
    onClear?: () => void
}): JSX.Element {
    const a = ix.action(value)
    const off = value == null
    const accent = categoryAccent(a.cat)
    return (
        <div
            className={cn(
                'flex items-center gap-2 py-1',
                disabled && 'opacity-50',
            )}
        >
            {slot ? (
                <span className="w-[72px] shrink-0 text-xs font-semibold text-muted-foreground">
                    {slot}
                </span>
            ) : null}
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className={cn(
                    'flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 text-left transition-colors enabled:hover:border-primary disabled:cursor-default',
                    off
                        ? 'border-dashed border-border bg-transparent text-muted-foreground'
                        : 'text-foreground',
                )}
                style={
                    off
                        ? undefined
                        : {
                              background: `color-mix(in oklch, ${accent} 10%, var(--secondary))`,
                              borderColor: `color-mix(in oklch, ${accent} 35%, var(--border))`,
                          }
                }
            >
                <span
                    className={cn(
                        'size-[7px] shrink-0 rounded-[3px]',
                        off && 'border border-muted-foreground',
                    )}
                    style={off ? undefined : { background: accent }}
                />
                <span className="flex-1 truncate text-[13px] font-semibold">
                    {a.label}
                </span>
                <span className="text-[10.5px] font-semibold text-muted-foreground">
                    {DEVICE_CATEGORY_META[a.cat].label}
                </span>
                <ChevronDown className="size-[13px] text-muted-foreground" />
            </button>
            {onClear && !disabled ? (
                <button
                    type="button"
                    aria-label={`Clear ${slot ?? 'action'}`}
                    onClick={onClear}
                    className="grid size-[30px] place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                    <X className="size-3.5" />
                </button>
            ) : null}
        </div>
    )
}

/** A two-column grid of analog outputs; the bound one is highlighted. */
export function OutSelect({
    options,
    value,
    disabled,
    onChange,
}: {
    options: readonly ControlOption[]
    value: string
    disabled?: boolean
    onChange: (id: string) => void
}): JSX.Element {
    return (
        <div className="grid grid-cols-2 gap-1.5">
            {options.map((o) => {
                const on = o.id === value
                return (
                    <button
                        key={o.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(o.id)}
                        className={cn(
                            'flex items-center gap-[7px] rounded-lg border px-2.5 py-2 text-left text-[12.5px] font-semibold disabled:cursor-default disabled:opacity-60',
                            on
                                ? 'border-primary/55 bg-[color-mix(in_oklch,var(--primary)_16%,var(--secondary))]'
                                : 'border-border bg-secondary',
                        )}
                    >
                        <span
                            className="size-[7px] rounded-[3px]"
                            style={{
                                background: categoryAccent(o.category ?? 'pad'),
                            }}
                        />
                        {o.label}
                    </button>
                )
            })}
        </div>
    )
}

/** A label (and hint) with a switch on the right. */
export function SwitchRow({
    label,
    hint,
    checked,
    disabled,
    onChange,
}: {
    label: string
    hint?: string
    checked: boolean
    disabled?: boolean
    onChange: (v: boolean) => void
}): JSX.Element {
    return (
        <label className="flex cursor-pointer items-center gap-2.5 py-[7px]">
            <span className="flex-1">
                <span className="block text-[13px] font-semibold">{label}</span>
                {hint ? (
                    <span className="block text-[11.5px] text-muted-foreground">
                        {hint}
                    </span>
                ) : null}
            </span>
            <Switch
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
            />
        </label>
    )
}
