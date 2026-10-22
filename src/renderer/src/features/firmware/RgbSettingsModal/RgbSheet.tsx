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
import { Lightbulb, Save } from 'lucide-react'

import useConnectionStore from '@/stores/connectionStore'
import useRgbSheetStore from '@/stores/rgbSheetStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Button } from '@/ui/button'
import { DockShell } from '@/ui/dock-shell'

import type { PaintApi } from '@/features/keymap/keyboard/stage/usePerKeyPaint'
import { DeviceRgbControls } from './DeviceRgbControls'
import { SimulationPanel } from './SimulationPanel'
import { IndicatorPanel } from './IndicatorPanel'
import { hasIndicators } from './indicators'
import { ComingSoon } from './ComingSoonSection'
import { PerKeyColorEditor } from './PerKeyColorEditor'
import { AdvancedPanels } from './AdvancedRgbPanels'
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
        <DockShell
            icon={Lightbulb}
            title="Lighting"
            tabs={SECTIONS}
            active={activeSection}
            onTab={setSection}
            onClose={onClose}
            actions={
                rgb && (
                    <Button
                        size="sm"
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
                )
            }
        >
            {activeSection === 'backlight' &&
                (rgb ? <DeviceRgbControls rgb={rgb} /> : <SimulationPanel />)}
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
        </DockShell>
    )
}
