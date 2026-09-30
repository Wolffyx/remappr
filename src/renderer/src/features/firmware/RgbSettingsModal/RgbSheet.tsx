// pattern-check: skip — RGB bottom-sheet shell; section switch + reuse of existing control panels
//
// Board-visible RGB lighting sheet, docked below the keyboard (like the keycode/
// behaviour picker) and toggled by the Header Lightbulb via rgbSheetStore. Because
// the board stays visible, the on-screen glow previews edits live. Sections:
//   • Backlight        — global effect (DeviceRgbControls / SimulationPanel)
//   • Per-key RGB      — select key(s) on the board, then colour them
//   • Mix RGB          — 2-zone timeline (placeholder, not yet implemented)
//   • Underglow        — RGB underglow / ZMK (placeholder)
//   • Indicator Light  — caps/layer indicators (placeholder)
//   • Advanced         — raw Mix-region + Indicator byte editors (power users)
import { Save, X } from 'lucide-react'

import useConnectionStore from '@/stores/connectionStore'
import useRgbSheetStore from '@/stores/rgbSheetStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Button } from '@/ui/button'
import { Card, CardContent } from '@/ui/card'

import type { PaintApi } from '@/features/keymap/keyboard/stage/usePerKeyPaint'
import { DeviceRgbControls } from './DeviceRgbControls'
import { SimulationPanel } from './SimulationPanel'
import { IndicatorPanel } from './IndicatorPanel'
import { hasIndicators } from './indicators'
import { ComingSoon } from './ComingSoonSection'
import { PerKeyColorEditor } from './PerKeyColorEditor'
import { AdvancedPanels } from './AdvancedRgbPanels'
import { RgbSheetNav } from './RgbSheetNav'
import { SECTIONS } from './rgbSheetSections'

interface Props {
    paint: PaintApi
    selectedKeyPosition: number | undefined
    multiSelection: Set<number>
    onClose: () => void
}

export function RgbSheet({
    paint,
    selectedKeyPosition,
    multiSelection,
    onClose,
}: Props): JSX.Element {
    const rgb = useConnectionStore((s) => s.service?.rgb)
    const section = useRgbSheetStore((s) => s.section)
    const setSection = useRgbSheetStore((s) => s.setSection)

    const activeSection = SECTIONS.some((s) => s.id === section)
        ? section
        : 'backlight'

    return (
        <div className="p-2 w-full">
            <Card className="relative">
                <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <RgbSheetNav
                            activeSection={activeSection}
                            setSection={setSection}
                        />
                        <div className="ml-auto flex items-center gap-1.5">
                            {rgb && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-1.5"
                                    onClick={(): void => {
                                        void saveWithToast(
                                            () => rgb.save(),
                                            'RGB settings saved to keyboard',
                                            'Save failed',
                                        )
                                    }}
                                >
                                    <Save className="size-3.5" />
                                    Save
                                </Button>
                            )}
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
                        {activeSection === 'backlight' &&
                            (rgb ? (
                                <DeviceRgbControls rgb={rgb} />
                            ) : (
                                <SimulationPanel />
                            ))}
                        {activeSection === 'perkey' && (
                            <PerKeyColorEditor
                                paint={paint}
                                selectedKeyPosition={selectedKeyPosition}
                                multiSelection={multiSelection}
                            />
                        )}
                        {activeSection === 'mix' && (
                            <ComingSoon
                                title="Mix RGB"
                                note="Split the keyboard into two zones, each with its own looping effect timeline. Coming soon."
                            />
                        )}
                        {activeSection === 'underglow' && (
                            <ComingSoon
                                title="Underglow"
                                note="RGB underglow control (ZMK / QMK rgblight). Coming soon."
                            />
                        )}
                        {activeSection === 'indicator' &&
                            (rgb && hasIndicators(rgb) ? (
                                <IndicatorPanel rgb={rgb} />
                            ) : (
                                <ComingSoon
                                    title="Indicator Light"
                                    note={
                                        rgb
                                            ? "This keyboard's firmware doesn't expose its indicator lights."
                                            : 'Connect a keyboard to edit its OS-lock indicators.'
                                    }
                                />
                            ))}
                        {activeSection === 'advanced' && <AdvancedPanels />}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
