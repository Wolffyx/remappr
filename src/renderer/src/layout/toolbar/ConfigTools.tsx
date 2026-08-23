// pattern-check: skip — toolbar cluster extracted from Header, no abstraction
//
// The config cluster: flash/export · dynamic entries · macros · the
// capability-gated dialogs · RGB · sideload · settings · community links.
import { useEffect } from 'react'
import { BookOpen, Lightbulb, Sliders, Sparkles } from 'lucide-react'

import { supportsRuntimeLighting } from '@firmware/config'
import { GitHubIcon } from '@/components/GitHubIcon'
import { DiscordIcon } from '@/components/DiscordIcon'
import { DISCORD_URL, DOCS_URL, REPO_URL } from '@/lib/constants'
import useConnectionStore from '@/stores/connectionStore'
import useConfigStore from '@/stores/configStore'
import useRgbSheetStore from '@/stores/rgbSheetStore'
import useAdvancedSheetStore from '@/stores/advancedSheetStore'
import { SideloadAction } from '@/features/firmware/SideloadAction'
import { Settings } from '@/components/modals/Settings'
import { SupportModal } from '@/components/modals/SupportModal'
import { Download as DownloadModal } from '@/components/modals/Download'
import { ToolbarButton, ToolbarLink, ToolbarSlot } from './ToolbarButton'
import { ToolbarModals } from './ToolbarModals'

export function ConfigTools(): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const rgbSheetOpen = useRgbSheetStore((s) => s.open)
    const toggleRgbSheet = useRgbSheetStore((s) => s.toggle)
    const setRgbSheetOpen = useRgbSheetStore((s) => s.setOpen)

    // Some firmwares drive lighting at compile time only — they expose no
    // runtime RGB-settings protocol, so the live controls cannot work against
    // them. Gated on the target's declared capability, never on its name.
    const rgbUnsupported = useConfigStore((s) => {
        const target = s.config?.meta.target
        return target ? !supportsRuntimeLighting(target) : false
    })
    useEffect((): void => {
        if (rgbUnsupported && rgbSheetOpen) setRgbSheetOpen(false)
    }, [rgbUnsupported, rgbSheetOpen, setRgbSheetOpen])

    // Dynamic entries + macros share one bottom-dock sheet (advancedSheetStore),
    // mutually exclusive with the RGB sheet. The two triggers open it at their
    // section: Sliders → dynamic (Tap Dance first), Sparkles → Macros.
    const advSheetOpen = useAdvancedSheetStore((s) => s.open)
    const advSection = useAdvancedSheetStore((s) => s.section)
    const openAdvSheet = useAdvancedSheetStore((s) => s.openAt)
    const setAdvSheetOpen = useAdvancedSheetStore((s) => s.setOpen)
    const openDynamicSheet = (): void => {
        setRgbSheetOpen(false)
        openAdvSheet('td')
    }
    const openMacroSheet = (): void => {
        setRgbSheetOpen(false)
        openAdvSheet('macros')
    }

    return (
        <>
            <ToolbarSlot tooltip="Flash & export config">
                <DownloadModal />
            </ToolbarSlot>
            <ToolbarButton
                feature="dynamic"
                icon={Sliders}
                tooltip="Dynamic Entries"
                label="Dynamic entries"
                disabled={!service}
                active={advSheetOpen && advSection !== 'macros'}
                activeStyle="solid"
                onClick={openDynamicSheet}
            />
            <ToolbarButton
                feature="macros"
                icon={Sparkles}
                tooltip="Macros"
                label="Macros"
                disabled={!service}
                active={advSheetOpen && advSection === 'macros'}
                activeStyle="solid"
                onClick={openMacroSheet}
            />
            <ToolbarModals disabled={!service} />
            {/* RGB lighting — opens the board-visible bottom sheet (device
                controls when an RGB keyboard is connected, else the on-screen
                simulation editor). Disabled when the target drives lighting at
                compile time only. The sheet itself renders in KeymapEditor. */}
            <ToolbarButton
                icon={Lightbulb}
                tooltip={
                    rgbUnsupported
                        ? 'RGB lighting is compile-time only on this firmware'
                        : 'RGB lighting'
                }
                label="RGB lighting"
                disabled={!service || rgbUnsupported}
                active={rgbSheetOpen}
                activeStyle="solid"
                onClick={(): void => {
                    setAdvSheetOpen(false)
                    toggleRgbSheet()
                }}
            />
            <SideloadAction />
            <ToolbarSlot tooltip="Settings">
                <Settings />
            </ToolbarSlot>
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
        </>
    )
}
