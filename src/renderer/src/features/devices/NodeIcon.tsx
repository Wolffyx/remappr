// Pattern check: no GoF pattern (-) — rejected — a presentational lookup over KIND_ICON for the two node rosters (dongle landing, device menu).
import type { JSX } from 'react'
import { Cpu } from 'lucide-react'
import type { DeviceKind } from '@firmware/devices/types'
import { KIND_ICON } from './formIcons'

/** A dongle node's icon by kind; a node of no known kind is a chip. */
export function NodeIcon({
    kind,
    className,
}: {
    kind?: DeviceKind
    className?: string
}): JSX.Element {
    const Icon = kind ? KIND_ICON[kind] : Cpu
    return <Icon className={className} />
}
