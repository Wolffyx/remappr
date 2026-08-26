// Pattern check: no GoF pattern (-) — rejected — one-facade settings view, same
// shape as ClusterDiagnosticsModal/WirelessSettingsModal; no abstraction warranted.
// pattern-check: skip — reads/writes through the service.unicode facade (§5.2-E)
import { useEffect, useState } from 'react'
import { Languages } from 'lucide-react'
import { toast } from 'sonner'

import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

interface Props {
    opened: boolean
    onClose: () => void
}

/** Mirrors enum remappr_unicode_mode: the index IS the wire value, and bit i of
 *  the device's support mask is method i. `hint` is what the USER must have set
 *  up on their host — the keyboard cannot detect it, which is the whole reason
 *  this is a setting rather than something automatic. */
const METHODS = [
    {
        label: 'Off',
        hint: 'A &unicode binding types nothing.',
    },
    {
        label: 'Linux (IBus/GTK)',
        hint: 'Types Ctrl+Shift+U, the hex digits, then Enter.',
    },
    {
        label: 'macOS',
        hint: 'Holds Option over the hex digits. Needs the "Unicode Hex Input" keyboard layout selected.',
    },
    {
        label: 'Windows',
        hint: 'Holds Alt over keypad + and the hex digits. Needs the EnableHexNumpad registry value.',
    },
    {
        label: 'WinCompose',
        hint: 'Types Compose, u, the hex digits, then Enter.',
    },
] as const

const errText = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

const labelFor = (mode: number): string =>
    METHODS[mode]?.label ?? `Unknown (${mode})`

export function UnicodeInputModal({ opened, onClose }: Props): JSX.Element {
    const unicode = useConnectionStore((s) => s.service?.unicode)

    const [mode, setMode] = useState<number | null>(null)
    const [supported, setSupported] = useState<number[]>([])
    const [selected, setSelected] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!opened || !unicode) return
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const s = await unicode.getMode()
                if (cancelled) return
                setMode(s.mode)
                setSelected(s.mode)
                setSupported(s.supported)
            } catch (e) {
                if (!cancelled)
                    toast.error(`Failed to read unicode mode: ${errText(e)}`)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return (): void => {
            cancelled = true
        }
    }, [opened, unicode])

    if (!unicode) return <></>

    const dirty = selected !== null && selected !== mode

    const save = async (): Promise<void> => {
        if (selected === null) return
        const r = await saveWithToast(
            () => unicode.setMode(selected),
            `Unicode input set to ${labelFor(selected)}`,
            'Failed to set unicode input method',
        )
        // Only commit to local state once the device accepted it — it rejects a
        // method it cannot type, and showing the new label anyway would claim a
        // selection the keyboard never took.
        if (r !== undefined) setMode(selected)
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Unicode Input"
            subtitle="How &unicode bindings type a codepoint"
            headerIcon={<Languages />}
        >
            <div className="flex flex-col gap-4 p-2 text-sm">
                <p className="text-xs text-muted-foreground">
                    No HID report carries a codepoint, so the keyboard types a
                    per-OS keystroke sequence instead. Your host has to already
                    be set up for the method you pick — the keyboard cannot
                    detect which one that is.
                </p>

                <section className="flex flex-col gap-2">
                    <Label htmlFor="unicode-mode" className="text-xs">
                        Input method
                    </Label>
                    <Select
                        value={selected === null ? undefined : String(selected)}
                        onValueChange={(v) => setSelected(Number(v))}
                        disabled={loading}
                    >
                        <SelectTrigger id="unicode-mode" className="w-64">
                            <SelectValue placeholder="Reading…" />
                        </SelectTrigger>
                        <SelectContent>
                            {supported.map((m) => (
                                <SelectItem key={m} value={String(m)}>
                                    {labelFor(m)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selected !== null && METHODS[selected] && (
                        <p className="text-[11px] text-muted-foreground">
                            {METHODS[selected].hint}
                        </p>
                    )}
                </section>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={save}
                        disabled={loading || !dirty}
                        className="w-40"
                    >
                        Save
                    </Button>
                    {mode !== null && (
                        <span className="text-[11px] text-muted-foreground">
                            On the keyboard: {labelFor(mode)} — kept across
                            reboots.
                        </span>
                    )}
                </div>
            </div>
        </Modal>
    )
}
