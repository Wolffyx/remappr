// Pattern check: no GoF pattern (-) — rejected — cmdk palette over the adapter's action catalog, the device twin of features/keymap/keyboard/CommandAssign.tsx.
import type { JSX } from 'react'
import { Check } from 'lucide-react'
import { bindingOf } from '@firmware/devices/defaults'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/ui/command'
import { categoryAccent } from '@/lib/devices/deviceCategory'
import { useBindingMutations } from '../model/bindingMutations'
import useDeviceEditorStore, {
    selectActiveBindings,
} from '../model/deviceEditorStore'

function Dot({ color }: { color: string }): JSX.Element {
    return (
        <span
            className="grid size-[30px] shrink-0 place-items-center rounded-md border"
            style={{
                background: `color-mix(in oklab, ${color} 16%, var(--secondary))`,
                borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
            }}
        >
            <span
                className="size-2 rounded-[3px]"
                style={{ background: color }}
            />
        </span>
    )
}

/** Workspace C's way to assign: a searchable palette of every action. */
export function DeviceCommandPalette(): JSX.Element | null {
    const pick = useDeviceEditorStore((s) => s.pick)
    const setPick = useDeviceEditorStore((s) => s.setPick)
    const loaded = useDeviceEditorStore((s) => s.loaded)
    const selected = useDeviceEditorStore((s) => s.selected)
    const bindings = useDeviceEditorStore(selectActiveBindings)
    const { patch } = useBindingMutations()
    const c = loaded?.model.controls.find((x) => x.id === selected)
    if (!loaded || !c) return null
    const current = pick
        ? (
              bindingOf(c, bindings, loaded.index.catalog) as unknown as Record<
                  string,
                  unknown
              >
          )[pick.field]
        : undefined
    const assign = (id: string | null): void => {
        if (pick) patch(c.id, { [pick.field]: id })
        setPick(null)
    }
    const { groups, actions } = loaded.index.catalog
    return (
        <CommandDialog
            open={!!pick}
            onOpenChange={(open) => !open && setPick(null)}
        >
            <CommandInput
                placeholder={`Assign action to ${pick?.title ?? ''}…`}
            />
            <CommandList className="max-h-[min(60vh,420px)]">
                <CommandEmpty>No actions match.</CommandEmpty>
                <CommandGroup heading="Disabled">
                    <CommandItem
                        value="Disabled none off"
                        onSelect={() => assign(null)}
                        className="gap-3"
                    >
                        <Dot color="var(--muted-foreground)" />
                        <span className="flex-1 font-semibold">Disabled</span>
                        {current == null && (
                            <Check className="size-3.5 text-primary" />
                        )}
                    </CommandItem>
                </CommandGroup>
                {groups.map((g) => (
                    <CommandGroup key={g.id} heading={g.label}>
                        {actions
                            .filter((a) => a.group === g.id)
                            .map((a) => (
                                <CommandItem
                                    key={a.id}
                                    value={`${a.label} ${g.label} ${a.id}`}
                                    onSelect={() => assign(a.id)}
                                    className="gap-3"
                                >
                                    <Dot color={categoryAccent(a.category)} />
                                    <span className="flex-1 font-semibold">
                                        {a.label}
                                    </span>
                                    {a.id === current && (
                                        <Check className="size-3.5 text-primary" />
                                    )}
                                    <span className="text-caption text-muted-foreground">
                                        {g.label}
                                    </span>
                                </CommandItem>
                            ))}
                    </CommandGroup>
                ))}
            </CommandList>
        </CommandDialog>
    )
}
