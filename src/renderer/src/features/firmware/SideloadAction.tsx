// pattern-check: skip — file-picker UI glue over the neutral SideloadApi
//
// One button per source the connected adapter says it accepts. The app does not
// know (and must not know) that VIA JSON or ZMK `.keymap` files exist: it reads
// `service.sideload.formats`, hands the picked file's text back to the adapter,
// and applies whatever neutral SideloadResult comes out.
import { useCallback, useReducer, useRef } from 'react'
import { Network, RotateCcw, Upload } from 'lucide-react'
import { toast } from 'sonner'

import type {
    SideloadFormat,
    SideloadKind,
    SideloadResult,
} from '@firmware/sideload'
import type { KeyboardService } from '@firmware/service'
import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import useConnectionStore from '@/stores/connectionStore'
import useConfigStore from '@/stores/configStore'
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

/** Apply a SideloadResult to the app's stores. */
function useApplySideloadResult(): (
    service: KeyboardService,
    result: SideloadResult,
) => Promise<void> {
    const setKeymap = useKeymapStore((s) => s.setKeymap)
    const setLightingCatalog = useLightingCatalogStore((s) => s.setCatalog)
    const setComboEntries = useDynamicCatalogStore(
        (s) => s.setSideloadedComboEntries,
    )
    return useCallback(
        async (service, result) => {
            // Each field is optional: a source contributes only what it
            // carries, and `undefined` means "leave this alone".
            if (result.lightingCatalog !== undefined)
                setLightingCatalog(result.lightingCatalog)
            if (result.catalogEntries)
                setComboEntries([...result.catalogEntries])
            if (result.keymapChanged) {
                setKeymap(await service.getKeymap())
                // A new layout can change the board itself (key count,
                // knobs), so a config the device serves is out of date:
                // re-read it now, before further edits raise into it.
                if (service.getConfigSource) {
                    useConfigStore.getState().markStale()
                    useConnectionStore.getState().reseedConfigIfStale()
                }
            }
        },
        [setKeymap, setLightingCatalog, setComboEntries],
    )
}

function SideloadButton({
    format,
    onLoaded,
}: {
    format: SideloadFormat
    onLoaded: () => void
}): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const applyResult = useApplySideloadResult()
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
                    await applyResult(service, result)
                    return result.name
                },
                null,
                `Failed to load ${format.label.toLowerCase()}`,
            )
            if (name) toast.success(`Loaded: ${name}`)
            onLoaded()
        },
        [service, format.id, format.label, applyResult, onLoaded],
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

/** Drops a loaded layout file and goes back to the one the board reports.
 *  Shown only while a file is in use, on adapters that offer it. */
function RevertToDeviceButton({
    onReverted,
}: {
    onReverted: () => void
}): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const applyResult = useApplySideloadResult()

    const onClick = useCallback(async (): Promise<void> => {
        const revert = service?.sideload?.revertToDevice
        if (!service || !revert) return
        const ok = await saveWithToast(
            async () => {
                await applyResult(service, await revert())
                return true
            },
            null,
            "Failed to read the board's layout",
        )
        if (ok) toast.success("Using the board's layout")
        onReverted()
    }, [service, applyResult, onReverted])

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClick}
                    aria-label="Use board's layout"
                >
                    <RotateCcw className="h-5 w-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>
                    Use board&apos;s layout: forget the loaded file and read the
                    layout stored on the keyboard.
                </p>
            </TooltipContent>
        </Tooltip>
    )
}

export function SideloadAction(): JSX.Element | null {
    const sideload = useConnectionStore((s) => s.service?.sideload)
    // The cache lives outside React; re-render after a load or revert so the
    // revert button follows it.
    const [, refresh] = useReducer((n: number) => n + 1, 0)
    if (!sideload || sideload.formats.length === 0) return null
    const canRevert = !!sideload.revertToDevice && !!sideload.readCached?.()
    return (
        <>
            {sideload.formats.map((f) => (
                <SideloadButton key={f.id} format={f} onLoaded={refresh} />
            ))}
            {canRevert && <RevertToDeviceButton onReverted={refresh} />}
        </>
    )
}
