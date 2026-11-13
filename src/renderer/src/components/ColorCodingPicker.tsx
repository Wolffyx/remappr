// Pattern check: no GoF pattern (-) — rejected — binds the shared Segmented to a
// single store field; no abstraction warranted.
import { Segmented } from '@/ui/segmented'
import useUserSettingsStore, {
    type ColorCodingMode,
} from '@/stores/userSettingsStore'

const OPTIONS: { value: ColorCodingMode; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'subtle', label: 'Subtle' },
    { value: 'vivid', label: 'Vivid' },
]

export function ColorCodingPicker(): JSX.Element {
    const colorMode = useUserSettingsStore((s) => s.colorMode)
    const setColorMode = useUserSettingsStore((s) => s.setColorMode)

    return (
        <Segmented
            label="Colour coding intensity"
            value={colorMode}
            options={OPTIONS}
            onChange={setColorMode}
        />
    )
}
