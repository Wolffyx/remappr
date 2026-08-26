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
import useUserSettingsStore from '@/stores/userSettingsStore'
import {
    adapterCategories,
    adaptersInCategory,
    categoryInfo,
    resolveCategory,
} from '@/lib/adapterCategories'
import { useFirmwareClientsReady } from '@/hooks/use-firmware-clients-ready'

export function CommunicationSection(): JSX.Element {
    const category = useUserSettingsStore((s) => s.preferredAdapterCategory)
    const setCategory = useUserSettingsStore(
        (s) => s.setPreferredAdapterCategory,
    )
    const autoLoadLayout = useUserSettingsStore((s) => s.autoLoadLayout)
    const setAutoLoadLayout = useUserSettingsStore((s) => s.setAutoLoadLayout)
    const autosave = useUserSettingsStore((s) => s.autosave)
    const setAutosave = useUserSettingsStore((s) => s.setAutosave)
    const autoRestoreProfile = useUserSettingsStore((s) => s.autoRestoreProfile)
    const setAutoRestoreProfile = useUserSettingsStore(
        (s) => s.setAutoRestoreProfile,
    )
    // Adapters register lazily; recompute once they're loaded so the picker
    // fills. Every family shown here is declared by an adapter — this screen
    // names no firmware of its own.
    const ready = useFirmwareClientsReady()
    const categories = ready ? adapterCategories() : []
    const selected = ready ? resolveCategory(category) : null
    const adapters = ready ? adaptersInCategory(selected) : []
    const info = categoryInfo(selected)
    const familyLabel = info?.label ?? 'Firmware'

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
                        value={selected ?? undefined}
                        onValueChange={setCategory}
                        disabled={categories.length === 0}
                    >
                        <SelectTrigger id="adapter-category" className="w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.label}
                                </SelectItem>
                            ))}
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
                <FieldGroup>
                    <FieldLabel htmlFor="auto-restore-profile">
                        <Field orientation="horizontal">
                            <FieldContent>
                                <FieldTitle>Auto-restore profile</FieldTitle>
                                <FieldDescription>
                                    Keep a backup of each keyboard&apos;s layout
                                    and, when a keyboard reconnects wiped or
                                    reset, restore it automatically instead of
                                    asking. When off, Remappr prompts you before
                                    restoring. Supported on ZMK today.
                                </FieldDescription>
                            </FieldContent>
                            <Switch
                                id="auto-restore-profile"
                                checked={autoRestoreProfile}
                                onCheckedChange={setAutoRestoreProfile}
                            />
                        </Field>
                    </FieldLabel>
                </FieldGroup>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                    {familyLabel} settings
                </h3>
                {info?.layoutRegistry ? (
                    <FieldGroup>
                        <FieldLabel htmlFor="auto-load-layout">
                            <Field orientation="horizontal">
                                <FieldContent>
                                    <FieldTitle>
                                        Auto-load layout from registry
                                    </FieldTitle>
                                    <FieldDescription>
                                        Look this board up in an online layout
                                        registry on connect. When off, use the
                                        toolbar&apos;s load button to upload a
                                        definition manually.
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
                        No {familyLabel}-specific settings yet.
                    </p>
                )}
            </div>
        </div>
    )
}
