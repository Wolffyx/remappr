// pattern-check: skip — toolbar cluster extracted from ConfigTools, no abstraction
//
// Project links — source, community, docs, donations. Centred in the top bar
// of both the editor and the start page.
import { BookOpen } from 'lucide-react'

import { GitHubIcon } from '@/components/GitHubIcon'
import { DiscordIcon } from '@/components/DiscordIcon'
import { SupportModal } from '@/components/modals/SupportModal'
import { DISCORD_URL, DOCS_URL, REPO_URL } from '@/lib/constants'
import { ToolbarLink, ToolbarSlot } from './ToolbarButton'

export function CommunityLinks(): JSX.Element {
    return (
        <div
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            <ToolbarLink
                icon={GitHubIcon}
                href={REPO_URL}
                tooltip="GitHub Repository"
                label="View source on GitHub"
            />
            <ToolbarLink
                icon={DiscordIcon}
                href={DISCORD_URL}
                tooltip="Discord Community"
                label="Join the Discord community"
            />
            <ToolbarLink
                icon={BookOpen}
                href={DOCS_URL}
                tooltip="Documentation"
                label="Open the documentation"
            />
            <ToolbarSlot tooltip="Support this project">
                <SupportModal />
            </ToolbarSlot>
        </div>
    )
}
