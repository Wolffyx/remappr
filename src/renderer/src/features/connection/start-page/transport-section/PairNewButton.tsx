// pattern-check: skip — small UI component, single caller branches by transport count
import { Bluetooth, Cable, Plus, Usb } from 'lucide-react'
import type { JSX } from 'react'
import { Button } from '@/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import type { TransportFactory } from '@/transport/types'

interface PairNewButtonProps {
    transports: TransportFactory[]
    onRequestNew: (t: TransportFactory) => void
    variant?: 'default' | 'outline'
    size?: 'default' | 'sm'
}

// pattern-check: skip — drop unused recommended flag from existing presenter
interface TransportPresentation {
    icon: JSX.Element
    title: string
    description: string
}

function presentTransport(t: TransportFactory): TransportPresentation {
    if (t.communication === 'ble' || t.isWireless) {
        return {
            icon: <Bluetooth className="h-4 w-4 text-info" />,
            title: 'Bluetooth',
            description: 'Wireless keyboards paired over BLE',
        }
    }
    if (t.communication === 'hid') {
        return {
            icon: <Cable className="h-4 w-4" />,
            title: 'USB (HID)',
            description: 'Raw HID firmware (e.g. QMK / VIA)',
        }
    }
    return {
        icon: <Usb className="h-4 w-4" />,
        title: 'USB (Serial)',
        description: 'Most ZMK keyboards over USB cable',
    }
}

export function PairNewButton({
    transports,
    onRequestNew,
    variant = 'default',
    size = 'default',
}: PairNewButtonProps): JSX.Element | null {
    if (transports.length === 0) return null

    if (transports.length === 1) {
        return (
            <Button
                variant={variant}
                size={size}
                onClick={() => onRequestNew(transports[0])}
            >
                <Plus className="mr-2 h-4 w-4" />
                Pair new device
            </Button>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant={variant} size={size}>
                    <Plus className="mr-2 h-4 w-4" />
                    Pair new device
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Choose connection type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {transports.map((t) => {
                    const p = presentTransport(t)
                    return (
                        <DropdownMenuItem
                            key={t.label}
                            onClick={() => onRequestNew(t)}
                            className="flex items-start gap-3 py-2.5"
                        >
                            <span className="mt-0.5 shrink-0">{p.icon}</span>
                            <span className="flex flex-col">
                                <span className="text-sm font-medium">
                                    {p.title}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {p.description}
                                </span>
                            </span>
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
