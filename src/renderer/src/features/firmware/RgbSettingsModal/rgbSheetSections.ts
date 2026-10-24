// pattern-check: skip — static section descriptor list split out of RgbSheetNav so
// the component file only exports components (react-refresh rule); pure data.
import {
    CircleDot,
    Grid3x3,
    Layers,
    SlidersHorizontal,
    Sparkles,
    Sun,
} from 'lucide-react'

import type { RgbSheetSection } from '@/stores/rgbSheetStore'

export const SECTIONS: {
    id: RgbSheetSection
    label: string
    icon: typeof Sun
}[] = [
    { id: 'backlight', label: 'Backlight', icon: Sun },
    { id: 'perkey', label: 'Per-key RGB', icon: Grid3x3 },
    { id: 'mix', label: 'Mix RGB', icon: Layers },
    { id: 'underglow', label: 'Underglow', icon: Sparkles },
    { id: 'indicator', label: 'Indicator lights', icon: CircleDot },
    { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal },
]
