// Pattern check: no GoF pattern (-) — rejected — modal with a lazily loaded Monaco JSON editor, validated through the firmware's parseDeviceLayout before it replaces the layout.
import { lazy, Suspense, useState, type JSX } from 'react'
import { Check, Code } from 'lucide-react'
import { layoutFromModel, parseDeviceLayout } from '@firmware/devices/schema'
import type { DeviceModel } from '@firmware/devices/types'
import { Button } from '@/ui/button'
import { Modal } from '@/ui/modal'

// Monaco is multi-MB: load it only when the modal first opens.
const LayoutJsonEditor = lazy(() => import('./LayoutJsonEditor'))

const toText = (m: DeviceModel): string =>
    JSON.stringify(layoutFromModel(m), null, 2)

/** The layout as a `remappr.device-layout` document, editable. */
export function LayoutJsonModal({
    opened,
    onClose,
    model,
    onApply,
}: {
    opened: boolean
    onClose: () => void
    model: DeviceModel
    onApply: (next: DeviceModel) => void
}): JSX.Element {
    // null = show the current layout (re-derived each time it opens).
    const [text, setText] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const close = (): void => {
        setText(null)
        setError(null)
        onClose()
    }
    const apply = (): void => {
        const r = parseDeviceLayout(text ?? toText(model))
        if (!r.ok) {
            setError(r.error)
            return
        }
        onApply(r.model)
        close()
    }
    return (
        <Modal
            opened={opened}
            onClose={close}
            title="Device layout"
            subtitle={`${model.name} · positions in key units (1U = 19.05 mm)`}
            headerIcon={<Code />}
            customModalBoxClass="w-11/12 max-w-2xl"
            isDismissable
            footer={
                <div className="flex w-full items-center gap-2">
                    {error ? (
                        <span className="flex-1 text-xs text-destructive">
                            {error}
                        </span>
                    ) : (
                        <span className="flex-1" />
                    )}
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setText(null)
                            setError(null)
                        }}
                    >
                        Revert
                    </Button>
                    <Button onClick={apply}>
                        <Check className="size-4" /> Apply layout
                    </Button>
                </div>
            }
        >
            <Suspense
                fallback={
                    <div className="grid h-[380px] place-items-center rounded-[10px] border border-input text-xs text-muted-foreground">
                        Loading editor…
                    </div>
                }
            >
                <LayoutJsonEditor
                    value={text ?? toText(model)}
                    onChange={(next) => {
                        setText(next)
                        setError(null)
                    }}
                />
            </Suspense>
        </Modal>
    )
}
