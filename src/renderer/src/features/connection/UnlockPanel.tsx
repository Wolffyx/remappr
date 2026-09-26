// Pattern check: no GoF pattern (-) — rejected — one presentational component with a layout prop replacing two duplicate ones; no class or interface hierarchy.
//
// The one unlock UI, for every firmware. What it shows comes from the device:
//   - the firmware's own guidance (Capabilities.unlockHint), when it has any;
//   - the keys to hold and a progress bar, when its unlock() reports them;
//   - Cancel / Try again, while the app is driving an unlock (unlockPromptStore).
// Where it sits follows the firmware's lock kind:
//   - layout 'screen' — an 'editor' lock (ZMK): replaces the editor until the
//     device reports it is unlocked;
//   - layout 'card'   — an 'actions' lock (Vial): floats over the editor while
//     an operation that needs the unlock waits for it; hidden otherwise.
import { useEffect, useId } from 'react'
import { Lock } from 'lucide-react'
import { ExternalLink } from '@/components/ExternalLink'
import { Button } from '@/ui/button'
import { usageGlyph } from '@/lib/actions/hidUsages'
import useConnectionStore from '@/stores/connectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useUnlockPromptStore, {
    dismissUnlockPrompt,
} from '@/stores/unlockPromptStore'

interface UnlockPanelProps {
    layout: 'screen' | 'card'
}

export function UnlockPanel({ layout }: UnlockPanelProps): JSX.Element | null {
    const service = useConnectionStore((s) => s.service)
    const hint = service?.capabilities.unlockHint
    const status = useUnlockPromptStore((s) => s.status)
    const keys = useUnlockPromptStore((s) => s.keys)
    const progress = useUnlockPromptStore((s) => s.progress)
    const error = useUnlockPromptStore((s) => s.error)
    const cancel = useUnlockPromptStore((s) => s.cancel)
    const retry = useUnlockPromptStore((s) => s.retry)
    // The keys to hold are physical; name them by the base layer's legends.
    const baseKeys = useKeymapStore((s) => s.keymap?.layers[0]?.keys)
    const titleId = useId()

    // A prompt belongs to the device that raised it.
    useEffect(() => () => dismissUnlockPrompt(), [service])

    const prompting = status !== 'idle'
    if (layout === 'card' && !prompting) return null

    // Same legend a keycap shows: the key's glyph, not its action-type tag.
    const names = keys.map((i) => {
        const label = baseKeys?.[i]?.label
        return (
            (label?.primaryUsage != null
                ? usageGlyph(label.primaryUsage)
                : '') ||
            label?.paramText ||
            label?.primary ||
            `Key ${i + 1}`
        )
    })

    const body = (
        <div
            role={layout === 'card' ? 'dialog' : undefined}
            aria-labelledby={titleId}
            className={
                layout === 'card'
                    ? 'fixed left-1/2 top-16 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 space-y-3 rounded-lg border bg-card p-5 shadow-lg'
                    : 'max-w-md space-y-4 rounded-lg border bg-card p-8 shadow-lg'
            }
        >
            <div className="flex items-center gap-3">
                <Lock className="h-6 w-6 text-primary" aria-hidden />
                <h2 id={titleId} className="text-xl font-semibold">
                    {layout === 'card'
                        ? 'Unlock the keyboard'
                        : 'Unlock To Continue'}
                </h2>
            </div>
            <p className="text-sm text-muted-foreground">
                {layout === 'card'
                    ? 'This change needs the keyboard unlocked.'
                    : 'For security reasons, your device requires unlocking before using Remappr.'}
                {prompting &&
                    (names.length > 0
                        ? ' Hold these keys until the bar fills:'
                        : ' Hold the unlock keys until the bar fills.')}
            </p>
            {hint && (
                <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{hint.message}</p>
                    {hint.docsUrl && (
                        <p>
                            <ExternalLink href={hint.docsUrl}>
                                {hint.docsLabel ?? 'Documentation'}
                            </ExternalLink>
                        </p>
                    )}
                </div>
            )}
            {names.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {names.map((name, i) => (
                        <kbd
                            key={keys[i]}
                            className="rounded-md border-2 border-primary bg-background px-2 py-1 font-keycap text-sm"
                        >
                            {name}
                        </kbd>
                    ))}
                </div>
            )}
            {prompting && (
                <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                >
                    <div
                        className="h-full bg-primary transition-[width] duration-150"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>
            )}
            {status === 'failed' && (
                <p className="text-sm text-destructive">
                    Unlock didn’t finish{error ? ` (${error})` : ''}.
                </p>
            )}
            {prompting && (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancel}>
                        Cancel
                    </Button>
                    {status === 'failed' && (
                        <Button size="sm" onClick={retry}>
                            Try again
                        </Button>
                    )}
                </div>
            )}
        </div>
    )

    if (layout === 'card') return body
    return (
        <div className="flex h-full w-full items-center justify-center bg-background p-6">
            {body}
        </div>
    )
}
