// pattern-check: skip — hover-preview restructure of layout chips, presentational only
import { useCallback, useState } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/popover'
import { LayerKeyboardPreview } from '../keyboard/LayerKeyboardPreview'
import {
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarGroupAction,
    SidebarMenuButton,
} from '@/ui/sidebar'
import { Check, Cpu, Plus } from 'lucide-react'
import type { PhysicalLayout } from '@firmware/types'

export type PhysicalLayoutItem = Pick<PhysicalLayout, 'name' | 'keys'>

export type PhysicalLayoutClickCallback = (index: number) => void

export interface PhysicalLayoutPickerProps {
    layouts: Array<PhysicalLayoutItem>
    selectedPhysicalLayoutIndex: number
    onPhysicalLayoutClicked?: PhysicalLayoutClickCallback
}

export const PhysicalLayoutPicker = ({
    layouts,
    selectedPhysicalLayoutIndex,
    onPhysicalLayoutClicked,
}: PhysicalLayoutPickerProps): JSX.Element => {
    // Which chip is hovered → its mini-keyboard preview popover is open.
    const [hovered, setHovered] = useState<number | null>(null)

    const handleLayoutSelect = useCallback(
        (index: number): void => {
            onPhysicalLayoutClicked?.(index)
        },
        [onPhysicalLayoutClicked],
    )

    return (
        <SidebarGroupContent>
            <SidebarGroupLabel className="eyebrow">Layouts</SidebarGroupLabel>
            <SidebarGroupAction title="Add layout">
                <Plus /> <span className="sr-only">Add layout</span>
            </SidebarGroupAction>
            {layouts && (
                <div className="space-y-2">
                    {layouts.map((layout, index) => {
                        const selected = index === selectedPhysicalLayoutIndex
                        return (
                            <Popover key={layout.name} open={hovered === index}>
                                <PopoverTrigger asChild>
                                    <SidebarMenuButton
                                        className="h-auto items-center gap-2.5 rounded-lg border px-2.5 py-2.5 data-[active=true]:bg-transparent"
                                        style={
                                            selected
                                                ? {
                                                      background:
                                                          'color-mix(in oklab, var(--primary) 12%, var(--sidebar))',
                                                      borderColor:
                                                          'color-mix(in oklab, var(--primary) 32%, transparent)',
                                                  }
                                                : {
                                                      borderColor:
                                                          'var(--sidebar-border)',
                                                  }
                                        }
                                        onMouseEnter={(): void =>
                                            setHovered(index)
                                        }
                                        onMouseLeave={(): void =>
                                            setHovered(null)
                                        }
                                        onClick={(): void =>
                                            handleLayoutSelect(index)
                                        }
                                    >
                                        <Cpu
                                            className="size-4 shrink-0"
                                            style={{
                                                color: selected
                                                    ? 'var(--primary)'
                                                    : 'var(--muted-foreground)',
                                            }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-panel-title font-bold leading-tight">
                                                {layout.name}
                                            </h3>
                                            <p className="truncate text-caption text-muted-foreground">
                                                {layout.keys.length} keys ·
                                                hover to preview
                                            </p>
                                        </div>
                                        {selected && (
                                            <Check
                                                className="size-4 shrink-0"
                                                style={{
                                                    color: 'var(--primary)',
                                                }}
                                            />
                                        )}
                                    </SidebarMenuButton>
                                </PopoverTrigger>
                                <PopoverContent
                                    side="right"
                                    align="start"
                                    sideOffset={12}
                                    onOpenAutoFocus={(e): void =>
                                        e.preventDefault()
                                    }
                                    className="pointer-events-none w-auto p-2"
                                >
                                    <div className="eyebrow mb-1 px-1">
                                        {layout.name} · {layout.keys.length}{' '}
                                        keys
                                    </div>
                                    <div className="flex justify-center">
                                        <LayerKeyboardPreview
                                            physicalLayoutIndex={index}
                                            oneU={13}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )
                    })}
                </div>
            )}
        </SidebarGroupContent>
    )
}
