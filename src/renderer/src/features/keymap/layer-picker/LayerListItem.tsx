// Pattern check: no GoF pattern (-) — rejected — the presentational layer row gains inline rename and move/copy menu items; still one component.
import { useEffect, useRef, useState } from 'react'
import {
    ArrowDown,
    ArrowUp,
    ClipboardCopy,
    Copy,
    EllipsisVertical,
    GripVertical,
    Pencil,
    Trash,
} from 'lucide-react'
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
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import type { DragHandlers } from '@/hooks/use-layer-drag-reorder'
import useLayerPeekStore from '@/stores/layerPeekStore'
import { layerAccent } from '@/lib/keymap/keyCategory'

interface LayerItem {
    id: number
    name: string
    index: number
}

interface LayerListItemProps {
    item: LayerItem
    selectedLayerIndex: number
    /** How many layers there are, for Move up / Move down. */
    count: number
    /** Every layer's name by index, for "Copy keys from". */
    names: readonly string[]
    canRemove?: boolean
    /** Read-only views hide rename and the menu. Defaults true. */
    editable?: boolean
    /** The firmware names its layers. Defaults true. */
    canRename?: boolean
    dragHandlers?: DragHandlers
    isDragSource?: boolean
    isDragOver?: boolean
    onSelect: (index: number) => void
    /** Absent on a firmware with a fixed layer count. */
    onRemove?: (index: number) => void
    onDuplicate?: (index: number) => void
    onMove?: (index: number, dest: number) => void
    onCopyFrom?: (index: number, source: number) => void
    onSaveNewLabel: (
        id: number,
        oldName: string,
        newName: string | null,
    ) => void
}

/** The name as an input; Enter or blur saves, Escape cancels. */
function RenameField({
    name,
    onDone,
}: {
    name: string
    onDone: (next: string | null) => void
}): JSX.Element {
    const ref = useRef<HTMLInputElement>(null)
    useEffect(() => ref.current?.select(), [])
    const finish = (value: string): void => {
        const next = value.trim()
        onDone(next && next !== name ? next : null)
    }
    return (
        <input
            ref={ref}
            defaultValue={name}
            aria-label="Layer name"
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => finish(e.currentTarget.value)}
            onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') finish(e.currentTarget.value)
                if (e.key === 'Escape') onDone(null)
            }}
            className="min-w-0 flex-1 rounded border border-primary bg-background px-1.5 text-panel-title text-foreground outline-none"
        />
    )
}

export function LayerListItem({
    item,
    selectedLayerIndex,
    count,
    names,
    canRemove,
    editable = true,
    canRename = true,
    dragHandlers,
    isDragSource,
    isDragOver,
    onSelect,
    onRemove,
    onDuplicate,
    onMove,
    onCopyFrom,
    onSaveNewLabel,
}: LayerListItemProps): JSX.Element {
    const setPeek = useLayerPeekStore((s) => s.setPeek)
    const [renaming, setRenaming] = useState(false)
    const ac = layerAccent(item.index)
    const active = item.index === selectedLayerIndex
    const others = names
        .map((name, index) => ({ name, index }))
        .filter((l) => l.index !== item.index)
    const renamable = editable && canRename
    const finishRename = (next: string | null): void => {
        setRenaming(false)
        if (next) onSaveNewLabel(item.id, item.name, next)
    }
    return (
        <SidebarMenuItem
            className={
                (isDragOver ? 'outline outline-1 outline-accent ' : '') +
                (isDragSource ? 'opacity-50 ' : '')
            }
            onMouseEnter={() => setPeek(item.index)}
            onMouseLeave={() => setPeek(null)}
            {...(dragHandlers && !renaming ? dragHandlers : {})}
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
                onDoubleClick={() => renamable && setRenaming(true)}
                onKeyDown={(e) => {
                    if (e.key === 'F2' && renamable) setRenaming(true)
                }}
                // Active row is tinted with the layer's own accent (design spec),
                // overriding shadcn's neutral bg-sidebar-accent via inline style.
                className="rounded-md border border-transparent data-[active=true]:bg-transparent"
                style={
                    active
                        ? {
                              background: `color-mix(in oklab, ${ac} 16%, var(--sidebar))`,
                              borderColor: `color-mix(in oklab, ${ac} 40%, transparent)`,
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
                    {renaming ? (
                        <RenameField name={item.name} onDone={finishRename} />
                    ) : (
                        <span
                            className={`flex-1 truncate text-panel-title ${active ? 'font-bold' : 'font-medium'}`}
                        >
                            {item.name}
                        </span>
                    )}
                    <span className="font-mono text-caption text-muted-foreground">
                        L{item.index}
                    </span>
                </span>
            </SidebarMenuButton>
            {editable && !renaming && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                            showOnHover
                            className="data-[state=open]:bg-accent rounded-sm"
                        >
                            <EllipsisVertical />{' '}
                            <span className="sr-only">Layer actions</span>
                        </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                        {renamable && (
                            <DropdownMenuItem onClick={() => setRenaming(true)}>
                                <Pencil />
                                <span>Rename</span>
                                <DropdownMenuShortcut>F2</DropdownMenuShortcut>
                            </DropdownMenuItem>
                        )}
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
                        {onCopyFrom && others.length > 0 && (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <ClipboardCopy className="size-4" />
                                    <span>Copy keys from</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    {others.map((l) => (
                                        <DropdownMenuItem
                                            key={l.index}
                                            onClick={() =>
                                                onCopyFrom(item.index, l.index)
                                            }
                                        >
                                            <span className="w-6 font-mono text-caption text-muted-foreground">
                                                L{l.index}
                                            </span>
                                            {l.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}
                        {onMove && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    disabled={item.index === 0}
                                    onClick={() =>
                                        onMove(item.index, item.index - 1)
                                    }
                                >
                                    <ArrowUp />
                                    <span>Move up</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={item.index >= count - 1}
                                    onClick={() =>
                                        onMove(item.index, item.index + 1)
                                    }
                                >
                                    <ArrowDown />
                                    <span>Move down</span>
                                </DropdownMenuItem>
                            </>
                        )}
                        {onRemove && (
                            <>
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
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </SidebarMenuItem>
    )
}
