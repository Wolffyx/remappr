// pattern-check: skip — Advanced bottom-sheet shell; section switch reusing dynamic/macro tab panels
//
// Dynamic entries + macros, docked below the keyboard (like the keycode/behaviour
// picker and the RGB sheet) and toggled by the Header Sliders (dynamic) / Sparkles
// (macros) triggers via advancedSheetStore. Mirrors RgbSheet 1:1. Sections appear
// only when the connected service advertises that capability — never gate on a
// firmware name. Mutually exclusive with the RGB sheet in the dock.
import { Layers, Repeat, Replace, Sparkles, Sliders, X } from 'lucide-react'

import type { KeyboardService } from '@firmware'
import useConnectionStore from '@/stores/connectionStore'
import useAdvancedSheetStore, {
    type AdvancedSheetSection,
} from '@/stores/advancedSheetStore'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/button'
import { Card, CardContent } from '@/ui/card'

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
    td: { label: 'Tap Dance', icon: Sliders },
    combo: { label: 'Combo', icon: Layers },
    ko: { label: 'Key Override', icon: Replace },
    ark: { label: 'Alt Repeat', icon: Repeat },
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
        <div className="p-2 w-full">
            <Card className="relative">
                <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <nav className="flex flex-wrap gap-1">
                            {sections.map((id) => {
                                const { label, icon: Icon } = SECTION_META[id]
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={(): void => setSection(id)}
                                        aria-current={
                                            activeSection === id
                                                ? 'page'
                                                : undefined
                                        }
                                        className={cn(
                                            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-panel-title font-medium transition-colors',
                                            activeSection === id
                                                ? 'bg-accent text-accent-foreground'
                                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                        )}
                                    >
                                        <Icon className="size-4 shrink-0" />
                                        {label}
                                    </button>
                                )
                            })}
                        </nav>
                        <div className="ml-auto flex items-center gap-1.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={onClose}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Native overflow (not radix ScrollArea): a max-height-only
                        radix Root has no definite height for its h-full viewport,
                        so tall content was clipped with no scrollbar. */}
                    <div className="max-h-[40vh] overflow-y-auto pr-2">
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
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
