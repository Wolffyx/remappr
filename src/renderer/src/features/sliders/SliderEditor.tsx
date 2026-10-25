// Pattern check: no GoF pattern (-) — rejected — presentational editor panel over useSliderEditor; one caller (BindingEditor).
//
// The binding editor for a slider, like the knob's: "What it does" picks a
// level (volume, backlight…) or keys. Keys show Down / Up chips over the normal
// key picker, a level its bottom, top and steps. A motorized slider says what
// its motor follows (set in the builder, with its pins).
import { ArrowLeftRight } from 'lucide-react'
import { useMemo } from 'react'
import type {
    ActionType,
    KeyAction,
    Keymap,
    SliderAction,
} from '@firmware/types'
import type { KeyboardService } from '@firmware/service'
import {
    SLIDER_MAP_INFO,
    sliderMapInfo,
    type SliderMap,
} from '@firmware/config'
import {
    type KeyActionDraft,
    KeyActionPicker,
} from '@/features/actions/KeyActionPicker'
import { LegendParts } from '@/features/keymap/keyboard/LegendParts'
import { knobSide } from '@/features/encoders/knobLegend'
import { AppSelect } from '@/ui/app-select'
import { Button } from '@/ui/button'
import { NumberInput } from '@/ui/number-input'
import { SLIDER_DIRS, useSliderDirStore } from './model'
import { useSliderEditor } from './useSliderEditor'

const FOLLOWS: Record<string, string> = {
    level: 'the level it sets',
    layer: 'each layer’s saved spot',
    app: 'a value from the app',
}

const STEP_CHOICES = [8, 16, 32, 50, 100]

interface SliderEditorProps {
    service: KeyboardService | undefined
    keymap: Keymap
    setKeymap: (fn: (prev: Keymap | undefined) => Keymap | undefined) => void
    layerIndex: number
    keyIndex: number
    actionTypes: ActionType[]
    layers: { id: number; name: string }[]
}

export function SliderEditor({
    service,
    keymap,
    setKeymap,
    layerIndex,
    keyIndex,
    actionTypes,
    layers,
}: SliderEditorProps): JSX.Element {
    const editor = useSliderEditor({ service, keymap, setKeymap, layerIndex })
    const dir = useSliderDirStore((s) => s.dir)
    const setDir = useSliderDirStore((s) => s.setDir)
    const layer = keymap.layers[layerIndex]
    const current = layer?.sliders?.[keyIndex]
    const layout = keymap.layouts.find((l) => l.id === keymap.activeLayoutId)
    const motor = layout?.keys[keyIndex]?.motor
    const number =
        (layout?.keys.slice(0, keyIndex).filter((k) => k.element === 'slider')
            .length ?? 0) + 1
    const info = current ? sliderMapInfo(current.map as SliderMap) : undefined

    // An unbound direction shows the layer's pass-through, from the firmware's
    // own action types (never a firmware-specific id).
    const placeholder = useMemo((): KeyAction | undefined => {
        if (!service) return undefined
        const t = actionTypes.find((a) => /trans/i.test(a.id))
        return t ? service.buildKeyAction(t.id, []) : layer?.keys[keyIndex]
    }, [service, actionTypes, layer, keyIndex])

    const write = (next: SliderAction | null): void =>
        editor.set(keyIndex, next)

    const pickMap = (map: string): void => {
        if (map === '') return write(null)
        const kind = sliderMapInfo(map as SliderMap).kind
        write(
            kind === 'level'
                ? {
                      map,
                      min: current?.min ?? 0,
                      max: current?.max ?? 100,
                      steps: current?.steps ?? 50,
                  }
                : map === 'keys'
                  ? {
                        map,
                        steps: current?.steps ?? 16,
                        up: current?.up,
                        down: current?.down,
                    }
                  : { map },
        )
    }

    const onPick = (draft: KeyActionDraft): void => {
        if (!service || !current) return
        const action = service.buildKeyAction(draft.kind, draft.params)
        write({ ...current, [dir]: action })
        if (dir === 'down') setDir('up')
    }

    const chips = (
        <div className="flex flex-row flex-wrap items-center gap-2">
            {SLIDER_DIRS.map(({ dir: d, short, long }) => {
                const side = current?.[d]
                    ? knobSide(current[d]!.label)
                    : undefined
                const active = d === dir
                return (
                    <button
                        key={d}
                        type="button"
                        title={long}
                        aria-pressed={active}
                        onClick={() => setDir(d)}
                        className={`flex items-center gap-2 rounded-md border-2 bg-card px-3 py-1.5 transition-colors hover:bg-accent/30 ${
                            active
                                ? 'ring-2 ring-primary border-primary'
                                : 'border-border'
                        }`}
                    >
                        <span className="eyebrow">{short}</span>
                        <span className="min-w-[2.5em] text-sm text-foreground">
                            {side?.parts ? (
                                <LegendParts
                                    parts={side.parts}
                                    title={side.title}
                                />
                            ) : side?.text ? (
                                side.text
                            ) : (
                                <span className="text-xs italic text-muted-foreground">
                                    —
                                </span>
                            )}
                        </span>
                    </button>
                )
            })}
            {editor.canEdit && current && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                        write({
                            ...current,
                            up: current.down,
                            down: current.up,
                        })
                    }
                    title="Swap the up and down bindings"
                >
                    <ArrowLeftRight className="h-4 w-4" />
                    Swap
                </Button>
            )}
        </div>
    )

    const stepsField = (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Steps
            <AppSelect
                value={String(current?.steps ?? 16)}
                onChange={(e) =>
                    current &&
                    write({ ...current, steps: Number(e.target.value) })
                }
                className="h-8 w-24"
            >
                {STEP_CHOICES.map((n) => (
                    <option key={n} value={String(n)}>
                        {n}
                    </option>
                ))}
            </AppSelect>
        </label>
    )

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground">
                    Slider {number}
                </span>
                <AppSelect
                    value={current?.map ?? ''}
                    onChange={(e) => pickMap(e.target.value)}
                    disabled={!editor.canEdit}
                    className="h-8 w-56"
                >
                    <option value="">Does nothing</option>
                    {SLIDER_MAP_INFO.filter(
                        (m) => m.id !== 'custom' || current?.map === 'custom',
                    ).map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.label}
                        </option>
                    ))}
                </AppSelect>
                {info?.kind === 'level' && current && (
                    <>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            Bottom
                            <NumberInput
                                aria-label="Bottom"
                                className="w-24"
                                unit="%"
                                value={current.min ?? 0}
                                onChange={(e) =>
                                    write({
                                        ...current,
                                        min: Number(e.target.value),
                                    })
                                }
                            />
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            Top
                            <NumberInput
                                aria-label="Top"
                                className="w-24"
                                unit="%"
                                value={current.max ?? 100}
                                onChange={(e) =>
                                    write({
                                        ...current,
                                        max: Number(e.target.value),
                                    })
                                }
                            />
                        </span>
                        {stepsField}
                    </>
                )}
                {info?.kind === 'keys' && info.id === 'keys' && stepsField}
            </div>
            {info?.kind === 'level' && (
                <p className="text-xs text-muted-foreground">
                    {info.owner === 'computer'
                        ? 'Sent as up / down steps. The computer doesn’t tell the keyboard where it is, so the two can drift apart until you reach the top or bottom.'
                        : 'The keyboard’s own level, so the slider and the light always match.'}
                </p>
            )}
            {motor && motor.follow !== 'off' && (
                <p className="text-xs text-muted-foreground">
                    Motorized: moves to {FOLLOWS[motor.follow] ?? motor.follow}.
                    Change it, the feel and its pins in the builder.
                </p>
            )}
            {info?.id === 'keys' && current && placeholder && (
                <KeyActionPicker
                    action={current[dir] ?? placeholder}
                    actionTypes={actionTypes}
                    layers={layers}
                    onChange={onPick}
                    headerExtra={chips}
                />
            )}
            {info?.id === 'custom' && (
                <p className="text-xs text-muted-foreground">
                    A custom action from the design file; pick another use to
                    change it.
                </p>
            )}
        </div>
    )
}
