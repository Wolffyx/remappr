// Pattern check: no GoF pattern (-) — rejected — presentational sidebar of the device editor (device card, device switcher, profiles, legend, device menu) on the shared @/ui/sidebar primitives.
import { useEffect, useRef, useState, type JSX } from 'react'
import { Check, Plus } from 'lucide-react'
import { DEMO_DEVICES } from '@firmware'
import type { DeviceProfile } from '@firmware/devices/types'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
} from '@/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { cn } from '@/lib/cn'
import { DeviceMenu } from '@/features/connection/device-menu/DeviceMenu'
import { connectDemo } from '@/features/connection/demo/connectDemo'
import { TrafficLightInset } from '@/layout/TrafficLightInset'
import useConnectionStore from '@/stores/connectionStore'
import {
    categoryAccent,
    DEVICE_CATEGORY_META,
    LEGEND_CATEGORIES,
    profileAccent,
} from '@/lib/devices/deviceCategory'
import { deviceSummary, FORM_LABEL } from '@/lib/devices/labels'
import { FORM_ICON } from './formIcons'
import { DeviceSwitcher, SwitchRow } from './DeviceSwitcher'
import useDeviceEditorStore from './model/deviceEditorStore'

const GROUP_LABEL =
    'text-caption font-bold tracking-[0.08em] text-muted-foreground uppercase'

function DeviceCard(): JSX.Element | null {
    const model = useDeviceEditorStore((s) => s.loaded?.model)
    if (!model) return null
    const Icon = FORM_ICON[model.form]
    return (
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-[color-mix(in_oklab,var(--primary)_12%,var(--sidebar))] px-[11px] py-2.5">
            <Icon className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
                <div className="truncate text-panel-title font-bold">
                    {model.name}
                </div>
                <div className="truncate text-caption text-muted-foreground">
                    {deviceSummary(model.form, model.controls)}
                    {model.defaulted ? ' · default layout' : ''}
                </div>
            </div>
            <Check className="size-[15px] shrink-0 text-primary" />
        </div>
    )
}

/** Other demo devices, one click away (demo sessions only). */
function DemoSwitcher(): JSX.Element | null {
    const demo = useConnectionStore((s) => !!s.service?.capabilities.demo)
    const name = useDeviceEditorStore((s) => s.loaded?.model.name)
    if (!demo) return null
    const others = DEMO_DEVICES.filter((d) => d.name !== name)
    return (
        <SidebarGroup>
            <SidebarGroupLabel className={GROUP_LABEL}>
                Switch device
            </SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col gap-[3px]">
                {others.map((d) => (
                    <SwitchRow
                        key={d.id}
                        icon={FORM_ICON[d.form]}
                        name={d.name}
                        detail={`${FORM_LABEL[d.form]}${d.ready ? '' : ' · no layout'}`}
                        onClick={() => void connectDemo(d.id)}
                    />
                ))}
            </SidebarGroupContent>
        </SidebarGroup>
    )
}

function ProfileRow({
    profile,
    index,
    active,
    onSelect,
    onRename,
}: {
    profile: DeviceProfile
    index: number
    active: boolean
    onSelect: () => void
    onRename?: (name: string) => void
}): JSX.Element {
    const [editing, setEditing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (editing) inputRef.current?.select()
    }, [editing])
    const accent = profileAccent(index)
    const finish = (value: string): void => {
        setEditing(false)
        const name = value.trim()
        if (name && name !== profile.name) onRename?.(name)
    }
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !editing) onSelect()
            }}
            onDoubleClick={() => onRename && setEditing(true)}
            className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border py-2 pr-2 pl-2.5 transition-colors',
                active ? '' : 'border-transparent hover:bg-accent',
            )}
            style={
                active
                    ? {
                          background: `color-mix(in oklab, ${accent} 16%, var(--sidebar))`,
                          borderColor: `color-mix(in oklab, ${accent} 40%, transparent)`,
                      }
                    : undefined
            }
        >
            <span
                className="size-[9px] shrink-0 rounded-[3px]"
                style={{
                    background: accent,
                    boxShadow: active ? `0 0 8px ${accent}` : 'none',
                }}
            />
            {editing ? (
                <input
                    ref={inputRef}
                    defaultValue={profile.name}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => finish(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') finish(e.currentTarget.value)
                        if (e.key === 'Escape') setEditing(false)
                    }}
                    className="min-w-0 flex-1 rounded border border-input bg-background px-1 text-panel-title outline-none"
                />
            ) : (
                <span
                    className={cn(
                        'min-w-0 flex-1 truncate text-panel-title',
                        active ? 'font-bold' : 'font-medium',
                    )}
                >
                    {profile.name}
                </span>
            )}
            <span className="font-mono text-caption text-muted-foreground">
                P{index + 1}
            </span>
        </div>
    )
}

function Profiles(): JSX.Element {
    const profiles = useDeviceEditorStore((s) => s.profiles)
    const activeId = useDeviceEditorStore((s) => s.activeProfileId)
    const canAdd = useDeviceEditorStore((s) => !!s.controls?.addProfile)
    const canRename = useDeviceEditorStore((s) => !!s.controls?.renameProfile)
    const show = useDeviceEditorStore((s) => s.showProfile)
    const add = useDeviceEditorStore((s) => s.addProfile)
    const rename = useDeviceEditorStore((s) => s.renameProfile)
    const addNext = (): void => void add(`Profile ${profiles.length + 1}`)
    return (
        <SidebarGroup>
            <SidebarGroupLabel className={GROUP_LABEL}>
                Profiles
            </SidebarGroupLabel>
            {canAdd && (
                <SidebarGroupAction title="Add profile" onClick={addNext}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Plus className="size-4" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Add profile</p>
                        </TooltipContent>
                    </Tooltip>
                </SidebarGroupAction>
            )}
            <SidebarGroupContent className="flex flex-col gap-[3px]">
                {profiles.map((p, i) => (
                    <ProfileRow
                        key={p.id}
                        profile={p}
                        index={i}
                        active={p.id === activeId}
                        onSelect={() => void show(p.id)}
                        onRename={
                            canRename
                                ? (name) => void rename(p.id, name)
                                : undefined
                        }
                    />
                ))}
                {canAdd && (
                    <button
                        type="button"
                        onClick={addNext}
                        className="mt-1 flex w-full items-center gap-2 rounded-md border border-dashed border-sidebar-border px-2.5 py-2 text-panel-title font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                        <Plus className="size-4" /> Add profile
                    </button>
                )}
            </SidebarGroupContent>
        </SidebarGroup>
    )
}

function ActionLegend(): JSX.Element {
    return (
        <>
            <SidebarGroupLabel className={GROUP_LABEL}>
                Action types
            </SidebarGroupLabel>
            <SidebarGroupContent>
                <ul className="flex flex-wrap gap-x-3 gap-y-1.5 px-2 py-1">
                    {LEGEND_CATEGORIES.map((cat) => (
                        <li
                            key={cat}
                            className="flex items-center gap-1.5 text-caption text-muted-foreground"
                        >
                            <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-[3px]"
                                style={{ background: categoryAccent(cat) }}
                            />
                            {DEVICE_CATEGORY_META[cat].label}
                        </li>
                    ))}
                </ul>
            </SidebarGroupContent>
        </>
    )
}

/** The device editor's sidebar. */
export function DeviceDrawer(): JSX.Element {
    return (
        <Sidebar collapsible="offcanvas" variant="sidebar">
            <SidebarContent className="pt-2">
                <TrafficLightInset variant="block" />
                <SidebarGroup>
                    <SidebarGroupLabel className={GROUP_LABEL}>
                        Device
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <DeviceCard />
                    </SidebarGroupContent>
                </SidebarGroup>
                <DemoSwitcher />
                <DeviceSwitcher />
                <Profiles />
                <SidebarGroup className="mt-auto">
                    <ActionLegend />
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <DeviceMenu />
            </SidebarFooter>
        </Sidebar>
    )
}
