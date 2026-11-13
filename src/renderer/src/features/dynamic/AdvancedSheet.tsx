// pattern-check: skip — Advanced bottom-sheet shell; section switch reusing dynamic/macro tab panels
//
// Dynamic entries + macros, docked below the keyboard (like the keycode/behaviour
// picker and the RGB sheet) and toggled by the Header Sliders (dynamic) / Sparkles
// (macros) triggers via advancedSheetStore. Mirrors RgbSheet 1:1. Sections appear
// only when the connected service advertises that capability — never gate on a
// firmware name. Mutually exclusive with the RGB sheet in the dock.
import { Layers, Repeat, Replace, Sparkles, Sliders } from 'lucide-react'

import type { KeyboardService } from '@firmware'
import useConnectionStore from '@/stores/connectionStore'
import useAdvancedSheetStore, {
    type AdvancedSheetSection,
} from '@/stores/advancedSheetStore'
import { DockShell } from '@/ui/dock-shell'

import { TapDanceTab } from './tabs/TapDanceTab'
import { ComboTab } from './tabs/ComboTab'
import { KeyOverrideTab } from './tabs/KeyOverrideTab'
import { AltRepeatKeyTab } from './tabs/AltRepeatKeyTab'
import { MacrosTab } from './tabs/MacrosTab'

interface Props {
    onClose: () => void
}

const SECTION_META: Record<
    AdvancedSheetSection,
    { label: string; icon: typeof Sliders }
> = {
    td: { label: 'Tap dance', icon: Sliders },
    combo: { label: 'Combo', icon: Layers },
    ko: { label: 'Key override', icon: Replace },
    ark: { label: 'Alt repeat', icon: Repeat },
    macros: { label: 'Macros', icon: Sparkles },
}

/** Which sections the connected service supports, in nav order. */
function availableSections(
    service: KeyboardService,
    counts:
        | ReturnType<NonNullable<KeyboardService['dynamic']>['getCounts']>
        | undefined,
): AdvancedSheetSection[] {
    const out: AdvancedSheetSection[] = []
    if (counts?.tapDance) out.push('td')
    if (counts?.combo) out.push('combo')
    if (counts?.keyOverride) out.push('ko')
    if (service.dynamic?.getAltRepeatKey) out.push('ark')
    if ((service.macros?.getCount() ?? 0) > 0) out.push('macros')
    return out
}

export function AdvancedSheet({ onClose }: Props): JSX.Element | null {
    const service = useConnectionStore((s) => s.service)
    const section = useAdvancedSheetStore((s) => s.section)
    const setSection = useAdvancedSheetStore((s) => s.setSection)

    if (!service) return null
    // getCounts once per render — availableSections and the section bodies
    // below share the same result.
    const counts = service.dynamic?.getCounts()
    const sections = availableSections(service, counts)
    if (sections.length === 0) return null

    const activeSection = sections.includes(section) ? section : sections[0]

    return (
        <DockShell
            icon={Sliders}
            title="Dynamic entries"
            tabs={sections.map((id) => ({ id, ...SECTION_META[id] }))}
            active={activeSection}
            onTab={setSection}
            onClose={onClose}
        >
            {activeSection === 'td' && counts && (
                <TapDanceTab
                    service={service}
                    count={counts.tapDance}
                    opened={true}
                />
            )}
            {activeSection === 'combo' && counts && (
                <ComboTab
                    service={service}
                    count={counts.combo}
                    opened={true}
                />
            )}
            {activeSection === 'ko' && counts && (
                <KeyOverrideTab
                    service={service}
                    count={counts.keyOverride}
                    opened={true}
                />
            )}
            {activeSection === 'ark' && (
                <AltRepeatKeyTab service={service} opened={true} />
            )}
            {activeSection === 'macros' && (
                <MacrosTab service={service} opened={true} />
            )}
        </DockShell>
    )
}
