// Pattern check: no GoF pattern (-) — rejected — presentational dropdown over the existing layouts and LayerKeyboardPreview; one caller.
import type { JSX } from 'react'
import { Check, ChevronDown, LayoutGrid } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { LayerKeyboardPreview } from '../keyboard/LayerKeyboardPreview'
import type { PhysicalLayoutPickerProps } from './PhysicalLayoutPicker'

/** The physical layout as one select (f12 D1): the active layout's name and
 *  "n of N"; the menu shows each layout's real keys as a thumbnail. */
export function LayoutSelect({
    layouts,
    selectedPhysicalLayoutIndex,
    onPhysicalLayoutClicked,
}: PhysicalLayoutPickerProps): JSX.Element {
    const current = layouts[selectedPhysicalLayoutIndex]
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Physical layout"
                    className="mt-2 flex h-[30px] w-full items-center gap-2 rounded-md border border-sidebar-border bg-background px-2 text-control text-foreground transition-colors hover:border-foreground/30 data-[state=open]:border-primary"
                >
                    <LayoutGrid className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-semibold">
                        {current?.name ?? 'Layout'}
                    </span>
                    <span className="shrink-0 text-caption text-muted-foreground">
                        {selectedPhysicalLayoutIndex + 1} of {layouts.length}
                    </span>
                    <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[300px]">
                <DropdownMenuLabel className="text-caption font-normal text-muted-foreground">
                    Physical layout
                </DropdownMenuLabel>
                {layouts.map((layout, index) => (
                    <DropdownMenuItem
                        key={index}
                        onClick={(): void => onPhysicalLayoutClicked?.(index)}
                        className="items-center gap-3"
                    >
                        <span className="pointer-events-none grid w-[96px] shrink-0 place-items-center overflow-hidden rounded bg-foreground/[.05] p-1">
                            <LayerKeyboardPreview
                                physicalLayoutIndex={index}
                                oneU={6}
                            />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                                {layout.name}
                            </span>
                            <span className="block text-caption text-muted-foreground">
                                {layout.keys.length} keys
                            </span>
                        </span>
                        {index === selectedPhysicalLayoutIndex && (
                            <Check className="size-4 text-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
