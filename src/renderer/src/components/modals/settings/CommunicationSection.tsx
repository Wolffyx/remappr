import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldTitle,
} from '@/ui/field'
import useUserSettingsStore, {
    type AdapterCategory,
} from '@/stores/userSettingsStore'
import { getAdapters } from '@firmware'
import { useFirmwareClientsReady } from '@/hooks/use-firmware-clients-ready'

const CATEGORY_LABEL: Record<AdapterCategory, string> = {
    zmk: 'ZMK',
    qmk: 'QMK',
}

function adaptersInCategory(
    category: AdapterCategory,
): { id: string; displayName: string }[] {
    const all = getAdapters()
    if (category === 'zmk') {
        return all
            .filter((a) => a.id === 'zmk')
            .map((a) => ({ id: a.id, displayName: a.displayName }))
    }
    return all
        .filter((a) => /^(qmk-|keychron-)/.test(a.id))
        .map((a) => ({ id: a.id, displayName: a.displayName }))
}

export function CommunicationSection(): JSX.Element {
    const category = useUserSettingsStore((s) => s.preferredAdapterCategory)
    const setCategory = useUserSettingsStore(
        (s) => s.setPreferredAdapterCategory,
    )
    const autoLoadLayout = useUserSettingsStore((s) => s.autoLoadLayout)
    const setAutoLoadLayout = useUserSettingsStore((s) => s.setAutoLoadLayout)
    const autosave = useUserSettingsStore((s) => s.autosave)
    const setAutosave = useUserSettingsStore((s) => s.setAutosave)
    // Adapters register lazily; recompute once they're loaded so the picker fills.
    const ready = useFirmwareClientsReady()
    const adapters = ready ? adaptersInCategory(category) : []

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Communication</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="adapter-category">
                            Firmware family
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Pick the family whose settings you want to
                            configure. Connection itself still auto-detects.
                        </p>
                    </div>
                    <Select
                        value={category}
                        onValueChange={(v) => setCategory(v as AdapterCategory)}
                    >
                        <SelectTrigger id="adapter-category" className="w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="zmk">
                                {CATEGORY_LABEL.zmk}
                            </SelectItem>
                            <SelectItem value="qmk">
                                {CATEGORY_LABEL.qmk}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {adapters.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {adapters.map((a) => (
                            <span
                                key={a.id}
                                className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground"
                            >
                                {a.displayName}
                            </span>
                        ))}
                    </div>
                )}
                <FieldGroup>
                    <FieldLabel htmlFor="auto-save">
                        <Field orientation="horizontal">
                            <FieldContent>
                                <FieldTitle>Auto-save</FieldTitle>
                                <FieldDescription>
                                    Save every change to the keyboard
                                    automatically. QMK/VIA/Keychron write each
                                    edit immediately; ZMK/Remappr commit about a
                                    second after your last edit. When off,
                                    changes wait until you press Save. The
                                    header Save button pulses while auto-save is
                                    on.
                                </FieldDescription>
                            </FieldContent>
                            <Switch
                                id="auto-save"
                                checked={autosave}
                                onCheckedChange={setAutosave}
                            />
                        </Field>
                    </FieldLabel>
                </FieldGroup>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                    {CATEGORY_LABEL[category]} settings
                </h3>
                {category === 'qmk' ? (
                    <FieldGroup>
                        <FieldLabel htmlFor="auto-load-layout">
                            <Field orientation="horizontal">
                                <FieldContent>
                                    <FieldTitle>
                                        Auto-load layout from registry
                                    </FieldTitle>
                                    <FieldDescription>
                                        Search the-via and Keychron repos on
                                        connect. When off, use the Load layout
                                        JSON button to upload manually.
                                    </FieldDescription>
                                </FieldContent>
                                <Switch
                                    id="auto-load-layout"
                                    checked={autoLoadLayout}
                                    onCheckedChange={setAutoLoadLayout}
                                />
                            </Field>
                        </FieldLabel>
                    </FieldGroup>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No ZMK-specific settings yet.
                    </p>
                )}
            </div>
        </div>
    )
}
