// pattern-check: skip — mounts the item dialog for a ?share= link once.
//
// A share link (…/?share=<token>) opens the shared item over whatever page the
// app starts on. The token leaves the address bar right away.
import { useState } from 'react'
import {
    CommunityItemDialog,
    type CommunityTarget,
} from './CommunityItemDialog'
import { takeShareTokenFromLocation } from './community'

export function ShareLinkHandler(): JSX.Element {
    const [target, setTarget] = useState<CommunityTarget | null>(() => {
        const token = takeShareTokenFromLocation()
        return token ? { token } : null
    })
    return (
        <CommunityItemDialog target={target} onClose={() => setTarget(null)} />
    )
}
