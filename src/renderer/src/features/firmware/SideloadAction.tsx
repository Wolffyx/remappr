// pattern-check: skip — file-picker UI glue over the neutral SideloadApi
//
// One button per source the connected adapter says it accepts. The app does not
// know (and must not know) that VIA JSON or ZMK `.keymap` files exist: it reads
// `service.sideload.formats`, hands the picked file's text back to the adapter,
// and applies whatever neutral SideloadResult comes out.
import { useCallback, useRef } from 'react'
import { Network, Upload } from 'lucide-react'
import { toast } from 'sonner'

import type { SideloadFormat, SideloadKind } from '@firmware/sideload'
import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import useConnectionStore from '@/stores/connectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useLightingCatalogStore from '@/stores/lightingCatalogStore'
import useDynamicCatalogStore from '@/stores/dynamicCatalogStore'
import { saveWithToast } from '@/lib/saveWithToast'

/** Semantic kind → affordance. The adapter says WHAT a source contributes; the
 *  app decides how that looks. */
const ICONS: Record<SideloadKind, typeof Upload> = {
    layout: Upload,
    catalog: Network,
}

function SideloadButton({ format }: { format: SideloadFormat }): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const setKeymap = useKeymapStore((s) => s.setKeymap)
    const setLightingCatalog = useLightingCatalogStore((s) => s.setCatalog)
    const setComboEntries = useDynamicCatalogStore(
        (s) => s.setSideloadedComboEntries,
    )
    const inputRef = useRef<HTMLInputElement | null>(null)
    const Icon = ICONS[format.kind]

    const onPick = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
            const file = e.target.files?.[0]
            e.target.value = ''
            const sideload = service?.sideload
            if (!file || !service || !sideload) return
            const name = await saveWithToast(
                async () => {
                    const result = await sideload.importFile(
                        format.id,
                        await file.text(),
                    )
                    // Each field is optional: a source contributes only what it
                    // carries, and `undefined` means "leave this alone".
                    if (result.lightingCatalog !== undefined)
                        setLightingCatalog(result.lightingCatalog)
                    if (result.catalogEntries)
                        setComboEntries([...result.catalogEntries])
                    if (result.keymapChanged)
                        setKeymap(await service.getKeymap())
                    return result.name
                },
                null,
                `Failed to load ${format.label.toLowerCase()}`,
            )
            if (name) toast.success(`Loaded: ${name}`)
        },
        [
            service,
            format.id,
            format.label,
            setKeymap,
            setLightingCatalog,
            setComboEntries,
        ],
    )

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept={format.accept}
                className="hidden"
                onChange={onPick}
            />
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(): void => inputRef.current?.click()}
                        aria-label={format.label}
                    >
                        <Icon className="h-5 w-5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{format.description ?? format.label}</p>
                </TooltipContent>
            </Tooltip>
        </>
    )
}

export function SideloadAction(): JSX.Element | null {
    const formats = useConnectionStore((s) => s.service?.sideload?.formats)
    if (!formats || formats.length === 0) return null
    return (
        <>
            {formats.map((f) => (
                <SideloadButton key={f.id} format={f} />
            ))}
        </>
    )
}
