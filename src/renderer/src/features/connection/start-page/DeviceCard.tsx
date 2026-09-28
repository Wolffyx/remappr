// Pattern check: no GoF pattern (-) — rejected — conditional presentational layout (full
// vertical preview card vs compact row) sharing one name-controls block; no abstraction.
import { useRef, useState } from 'react'
import {
    Bluetooth,
    Check,
    Loader2,
    Pencil,
    SignalHigh,
    Trash2,
    Usb,
    X,
} from 'lucide-react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { cn } from '@/lib/cn'
import type { DeviceStatus } from '@/features/connection/types'
import type { DevicePreviewSnapshot } from '@/stores/devicePreviewStore'
import { MiniKeyboardPreview } from './MiniKeyboardPreview'
import { StatusBadge } from './DeviceCardStatusBadge'

export interface DeviceCardProps {
    name: string
    status: DeviceStatus
    isWireless?: boolean
    onConnect: () => void
    onDisconnect?: () => void
    disabled?: boolean
    canRename?: boolean
    onRename?: (newName: string) => void
    onForget?: () => void
    /** Cached real base-layer layout — when present, the card shows the full preview. */
    preview?: DevicePreviewSnapshot
}

// pattern-check: skip — StatusBadge + STATUS_CONFIG moved verbatim to sibling file
function communicationLabel(
    comm: DevicePreviewSnapshot['communication'],
): string {
    if (comm === 'ble') return 'Bluetooth'
    if (comm === 'serial') return 'USB Serial'
    return 'USB HID'
}

export function DeviceCard({
    name,
    status,
    isWireless = false,
    onConnect,
    onDisconnect,
    disabled = false,
    canRename = false,
    onRename,
    onForget,
    preview,
}: DeviceCardProps): JSX.Element {
    const isConnecting = status === 'connecting'
    const isConnected = status === 'connected'

    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(name)
    const [confirmingForget, setConfirmingForget] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const startEdit = (): void => {
        setDraft(name)
        setEditing(true)
        queueMicrotask(() => inputRef.current?.select())
    }
    const commit = (): void => {
        const next = draft.trim()
        if (next && next !== name && onRename) onRename(next)
        setEditing(false)
    }
    const cancel = (): void => {
        setDraft(name)
        setEditing(false)
    }

    const cardClickable =
        !disabled && !editing && !confirmingForget && status === 'available'
    const handleCardActivate = (): void => {
        if (!cardClickable) return
        onConnect()
    }

    // Shared name + rename/forget controls, used by both card variants.
    const nameControls = (
        <div className="flex items-center gap-2">
            {editing ? (
                <>
                    <Input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commit()
                            else if (e.key === 'Escape') cancel()
                        }}
                        className="h-7 text-sm"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={commit}
                        aria-label="Save name"
                    >
                        <Check className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={cancel}
                        aria-label="Cancel rename"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </>
            ) : (
                <>
                    <p className="font-semibold truncate text-foreground">
                        {name}
                    </p>
                    {canRename && onRename && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
                            onClick={(e) => {
                                e.stopPropagation()
                                startEdit()
                            }}
                            aria-label="Rename device"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    {onForget && !isConnected && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                'h-6 w-6 shrink-0 opacity-60 hover:opacity-100',
                                confirmingForget &&
                                    'opacity-100 text-destructive',
                            )}
                            onClick={(e) => {
                                e.stopPropagation()
                                if (confirmingForget) {
                                    onForget()
                                    setConfirmingForget(false)
                                } else {
                                    setConfirmingForget(true)
                                }
                            }}
                            onBlur={() => setConfirmingForget(false)}
                            aria-label={
                                confirmingForget
                                    ? 'Confirm remove device'
                                    : 'Remove device'
                            }
                            title={
                                confirmingForget
                                    ? 'Click again to confirm'
                                    : 'Remove device'
                            }
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    {isWireless && (
                        <SignalHigh className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                </>
            )}
        </div>
    )

    const connectButton = isConnected ? (
        <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
                e.stopPropagation()
                onDisconnect?.()
            }}
            className="border-primary/30 hover:border-primary hover:bg-primary/10"
        >
            Disconnect
        </Button>
    ) : (
        <Button
            size="sm"
            onClick={(e) => {
                e.stopPropagation()
                onConnect()
            }}
            disabled={isConnecting}
            className={cn(
                'min-w-[100px]',
                !isConnecting &&
                    'shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30',
            )}
        >
            {isConnecting ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connecting</span>
                </>
            ) : (
                'Connect'
            )}
        </Button>
    )

    const wrapperClassName = cn(
        'group relative overflow-hidden rounded-xl border bg-card transition-all duration-300',
        'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
        cardClickable &&
            'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isConnected && 'border-primary/50 bg-primary/5',
        isConnecting && 'border-amber-500/50',
        disabled && 'opacity-50 pointer-events-none',
        preview ? 'p-5' : 'p-4',
    )

    const interactionProps = {
        role: cardClickable ? ('button' as const) : undefined,
        tabIndex: cardClickable ? 0 : undefined,
        'aria-label': cardClickable ? `Connect to ${name}` : undefined,
        'aria-disabled':
            !cardClickable && !isConnected ? (true as const) : undefined,
        onClick: cardClickable ? handleCardActivate : undefined,
        onKeyDown: cardClickable
            ? (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleCardActivate()
                  }
              }
            : undefined,
    }

    // ---- Full vertical preview card (device connected before) ----
    if (preview) {
        return (
            <div {...interactionProps} className={wrapperClassName}>
                <div
                    className={cn(
                        'absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                        'group-hover:opacity-100',
                        isConnected && 'opacity-100',
                    )}
                />
                {/* Dotted backdrop behind the preview, matching the editor stage. */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-40"
                    style={{
                        backgroundImage:
                            'radial-gradient(color-mix(in oklch, var(--muted-foreground) 22%, transparent) 1px, transparent 1px)',
                        backgroundSize: '16px 16px',
                        maskImage:
                            'radial-gradient(120% 80% at 50% 40%, black 30%, transparent 75%)',
                    }}
                />

                <div className="relative flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">{nameControls}</div>
                        <StatusBadge status={status} prominent />
                    </div>

                    <div className="flex min-h-[132px] items-center justify-center overflow-hidden py-2">
                        <MiniKeyboardPreview
                            keys={preview.keys}
                            encoders={preview.encoders}
                            oneU={20}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {isWireless ? (
                                <Bluetooth className="h-4 w-4" />
                            ) : (
                                <Usb className="h-4 w-4" />
                            )}
                            <span className="font-mono">
                                {communicationLabel(preview.communication)} ·{' '}
                                {preview.keyCount} keys · {preview.layerCount}{' '}
                                layers
                            </span>
                        </div>
                        <div className="shrink-0">{connectButton}</div>
                    </div>
                </div>
            </div>
        )
    }

    // ---- Compact card (never connected — no cached layout) ----
    return (
        <div {...interactionProps} className={wrapperClassName}>
            <div
                className={cn(
                    'absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                    'group-hover:opacity-100',
                    isConnected && 'opacity-100',
                )}
            />

            <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div
                        className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
                            isWireless
                                ? 'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20'
                                : 'bg-muted text-muted-foreground group-hover:bg-muted/80',
                            isConnected &&
                                (isWireless
                                    ? 'bg-blue-500/20'
                                    : 'bg-primary/10 text-primary'),
                        )}
                    >
                        {isWireless ? (
                            <Bluetooth className="h-6 w-6" />
                        ) : (
                            <Usb className="h-6 w-6" />
                        )}
                    </div>

                    <div className="min-w-0 space-y-1">
                        {nameControls}
                        <div className="flex items-center gap-2">
                            <StatusBadge status={status} />
                            <span className="text-xs text-muted-foreground">
                                {isWireless ? 'Bluetooth' : 'USB'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="shrink-0">{connectButton}</div>
            </div>
        </div>
    )
}
