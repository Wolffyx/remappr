import { Copy, EllipsisVertical, GripVertical, Trash } from 'lucide-react'
import LayerNameDialog from '../editor/LayerNameDialog'
import {
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/ui/sidebar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import type { DragHandlers } from '@/hooks/use-layer-drag-reorder'
import useLayerPeekStore from '@/stores/layerPeekStore'
import { layerAccent } from '@/lib/keymap/keyCategory'

// pattern-check: skip — presentational accent-dot/index helper, no abstraction
interface LayerItem {
    id: number
    name: string
    index: number
    selected: boolean
}

// pattern-check: skip — additive optional `editable` prop on existing props
interface LayerListItemProps {
    item: LayerItem
    selectedLayerIndex: number
    canRemove?: boolean
    /** Read-only views hide the rename/duplicate/delete menu. Defaults true. */
    editable?: boolean
    dragHandlers?: DragHandlers
    isDragSource?: boolean
    isDragOver?: boolean
    onSelect: (index: number) => void
    onRemove: (index: number) => void
    onDuplicate?: (index: number) => void
    onSaveNewLabel: (
        id: number,
        oldName: string,
        newName: string | null,
    ) => void
}

export function LayerListItem({
    item,
    selectedLayerIndex,
    canRemove,
    editable = true,
    dragHandlers,
    isDragSource,
    isDragOver,
    onSelect,
    onRemove,
    onDuplicate,
    onSaveNewLabel,
}: LayerListItemProps): JSX.Element {
    const setPeek = useLayerPeekStore((s) => s.setPeek)
    const ac = layerAccent(item.index)
    const active = item.index === selectedLayerIndex
    return (
        <SidebarMenuItem
            className={
                (isDragOver ? 'outline outline-1 outline-accent ' : '') +
                (isDragSource ? 'opacity-50 ' : '')
            }
            onMouseEnter={() => setPeek(item.index)}
            onMouseLeave={() => setPeek(null)}
            {...(dragHandlers ?? {})}
        >
            {dragHandlers && (
                <span
                    aria-label="Drag to reorder"
                    className="absolute left-0.5 top-1/2 z-10 -translate-y-1/2 cursor-grab text-muted-foreground/60 hover:text-foreground"
                >
                    <GripVertical className="size-3" />
                </span>
            )}
            <SidebarMenuButton
                asChild
                isActive={active}
                onClick={() => onSelect(item.index)}
                // Active row is tinted with the layer's own accent (design spec),
                // overriding shadcn's neutral bg-sidebar-accent via inline style.
                className="rounded-[9px] border border-transparent data-[active=true]:bg-transparent"
                style={
                    active
                        ? {
                              background: `color-mix(in oklch, ${ac} 16%, var(--sidebar))`,
                              borderColor: `color-mix(in oklch, ${ac} 40%, transparent)`,
                          }
                        : undefined
                }
            >
                <span className="flex items-center gap-2 pl-3 pr-6">
                    <span
                        aria-hidden
                        className="size-[9px] shrink-0 rounded-[3px]"
                        style={{
                            background: ac,
                            boxShadow: active ? `0 0 8px ${ac}` : 'none',
                        }}
                    />
                    <span
                        className={`flex-1 truncate text-[13.5px] ${active ? 'font-bold' : 'font-medium'}`}
                    >
                        {item.name}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                        L{item.index}
                    </span>
                </span>
            </SidebarMenuButton>
            {editable && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                            showOnHover
                            className="data-[state=open]:bg-accent rounded-sm"
                        >
                            <EllipsisVertical />{' '}
                            <span className="sr-only">More</span>
                        </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <LayerNameDialog
                                onClose={() => {}}
                                editLabelData={item}
                                handleSaveNewLabel={onSaveNewLabel}
                            />
                        </DropdownMenuItem>
                        {onDuplicate && (
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDuplicate(item.index)
                                }}
                            >
                                <Copy />
                                <span>Duplicate</span>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            disabled={!canRemove}
                            onClick={(e) => {
                                e.stopPropagation()
                                onRemove(item.index)
                            }}
                        >
                            <Trash />
                            <span>Delete</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </SidebarMenuItem>
    )
}
