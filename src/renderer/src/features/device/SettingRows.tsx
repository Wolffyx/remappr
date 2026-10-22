// Pattern check: no GoF pattern (-) — rejected — presentational rows for the
// device settings pages (a titled section, a number row, a switch row); plain
// composition over the ui primitives.
import { SwitchRow } from '@/ui/switch-row'
import type { JSX, ReactNode } from 'react'
import type { DeviceNumberField } from '@firmware/config'

import { cn } from '@/lib/cn'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

export function SettingsSection({
    title,
    description,
    actions,
    children,
}: {
    title: string
    description?: string
    actions?: ReactNode
    children: ReactNode
}): JSX.Element {
    return (
        <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    {description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {actions}
            </div>
            <div className="flex flex-col gap-3">{children}</div>
        </section>
    )
}

/** A number setting edited as text: empty = the firmware default, shown as the
 *  placeholder. */
export function NumberSettingRow<K extends string>({
    field,
    value,
    error,
    disabled,
    onChange,
}: {
    field: DeviceNumberField<K>
    value: string
    error?: string
    disabled?: boolean
    onChange: (value: string) => void
}): JSX.Element {
    const id = `setting-${field.key}`
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Label htmlFor={id} className="w-40 shrink-0 text-xs">
                    {field.label}
                </Label>
                <Input
                    id={id}
                    inputMode="numeric"
                    value={value}
                    placeholder={String(field.defaultValue)}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    aria-invalid={!!error}
                    className={cn('h-8 w-28', error && 'border-destructive')}
                />
                {field.unit && (
                    <span className="text-meta text-muted-foreground">
                        {field.unit}
                    </span>
                )}
                {error && (
                    <span className="text-caption text-destructive">
                        {error}
                    </span>
                )}
            </div>
            <p className="pl-[10.5rem] text-caption text-muted-foreground">
                {field.description} Empty = default ({field.defaultValue}
                {field.unit && ` ${field.unit}`}).
            </p>
        </div>
    )
}

export function SwitchSettingRow({
    label,
    description,
    checked,
    disabled,
    onChange,
}: {
    id?: string
    label: string
    description?: string
    checked: boolean
    disabled?: boolean
    onChange: (checked: boolean) => void
}): JSX.Element {
    return (
        <SwitchRow
            label={label}
            hint={description}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
        />
    )
}
