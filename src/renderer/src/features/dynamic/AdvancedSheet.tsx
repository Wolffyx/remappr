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
import { serviceHasFamily } from '@/features/firmware/behaviorFamily'
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
    td: { label: 'Tap dances', icon: Sliders },
    combo: { label: 'Combos', icon: Layers },
    ko: { label: 'Key overrides', icon: Replace },
    ark: { label: 'Alt repeat', icon: Repeat },
    macros: { label: 'Macros', icon: Sparkles },
}

/** Which sections the connected service supports, in nav order. A section
 *  whose behavior family the keyboard was built without is left out. */
function availableSections(
    service: KeyboardService,
    counts:
        | ReturnType<NonNullable<KeyboardService['dynamic']>['getCounts']>
        | undefined,
): AdvancedSheetSection[] {
    const has = (f: Parameters<typeof serviceHasFamily>[1]): boolean =>
        serviceHasFamily(service, f)
    const out: AdvancedSheetSection[] = []
    if ((service.macros?.getCount() ?? 0) > 0 && has('macros'))
        out.push('macros')
    if (counts?.tapDance && has('sequences')) out.push('td')
    if (counts?.combo && has('combos')) out.push('combo')
    if (counts?.keyOverride && has('keyOverrides')) out.push('ko')
    if (service.dynamic?.getAltRepeatKey) out.push('ark')
    return out
}

/** How many entries a section holds, for its tab label; undefined = no count. */
function sectionCount(
    id: AdvancedSheetSection,
    service: KeyboardService,
    counts:
        | ReturnType<NonNullable<KeyboardService['dynamic']>['getCounts']>
        | undefined,
): number | undefined {
    const byId: Partial<Record<AdvancedSheetSection, number | undefined>> = {
        macros: service.macros?.getCount(),
        td: counts?.tapDance,
        combo: counts?.combo,
        ko: counts?.keyOverride,
    }
    return byId[id]
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
            tabs={sections.map((id) => {
                // DockTab labels are plain strings, so the count rides in the label.
                const n = sectionCount(id, service, counts)
                const meta = SECTION_META[id]
                return {
                    id,
                    icon: meta.icon,
                    label: n === undefined ? meta.label : `${meta.label} ${n}`,
                }
            })}
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
