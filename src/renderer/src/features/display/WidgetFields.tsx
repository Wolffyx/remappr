// Pattern check: no GoF pattern (-) — rejected — presentational field rows per widget kind; kind → extra fields as a Dispatch Map (Tier 0).
//
// One widget's fields: its box, the text look (font, align), invert and
// frame, and what its kind shows (a text, a value from the screen registry,
// a bar's full value, a clock format, a picture). A picture is fitted into
// the widget's box and turned 1-bit here (dithered or a plain threshold).
import { JSX, useRef, useState } from 'react'
import { ImageUp } from 'lucide-react'
import type { ConfigScreenWidget } from '@firmware/config/types'
import type { ScreensApi } from '@firmware/service'
import useHostTextStore from '@/stores/hostTextStore'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Segmented } from '@/ui/segmented'
import { SwitchRow } from '@/ui/switch-row'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

type Patch = (p: Partial<ConfigScreenWidget>) => void

interface FieldsProps {
    screens: ScreensApi
    w: ConfigScreenWidget
    set: Patch
    disabled: boolean
}

function Row({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}): JSX.Element {
    return (
        <label className="flex items-center gap-2.5 py-1">
            <span className="w-20 shrink-0 text-xs font-semibold text-muted-foreground">
                {label}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {children}
            </div>
        </label>
    )
}

function Num({
    label,
    value,
    min,
    max,
    disabled,
    onChange,
}: {
    label: string
    value: number
    min: number
    max: number
    disabled: boolean
    onChange: (n: number) => void
}): JSX.Element {
    return (
        <span className="flex items-center gap-1">
            <span className="text-caption text-muted-foreground">{label}</span>
            <Input
                type="number"
                inputMode="numeric"
                aria-label={label}
                min={min}
                max={max}
                value={value}
                disabled={disabled}
                onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    if (Number.isFinite(n))
                        onChange(Math.max(min, Math.min(max, n)))
                }}
                className="h-7 w-[4.5rem] text-right font-mono text-xs"
            />
        </span>
    )
}

function SourceField({ screens, w, set, disabled }: FieldsProps): JSX.Element {
    const deviceSources = screens.sources.filter((s) => s.from === 'device')
    const hostSources = screens.sources.filter((s) => s.from === 'host')
    const texts = useHostTextStore((s) => s.texts)
    const setText = useHostTextStore((s) => s.setText)
    const userKey = /^host\.(user\d+)$/.exec(w.source ?? '')?.[1]
    return (
        <>
            <Row label="Shows">
                <Select
                    value={w.source}
                    disabled={disabled}
                    onValueChange={(source) => set({ source })}
                >
                    <SelectTrigger className="h-8 w-56">
                        <SelectValue placeholder="Pick a value" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Device</SelectLabel>
                            {deviceSources.map((s) => (
                                <SelectItem key={s.name} value={s.name}>
                                    {s.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>This computer</SelectLabel>
                            {hostSources.map((s) => (
                                <SelectItem key={s.name} value={s.name}>
                                    {s.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </Row>
            {userKey && (
                <Row label="Text">
                    <Input
                        aria-label="Text shown"
                        value={texts[userKey] ?? ''}
                        maxLength={64}
                        placeholder="Shown while this app runs"
                        onChange={(e) => setText(userKey, e.target.value)}
                        className="h-8"
                    />
                </Row>
            )}
        </>
    )
}

interface Picture {
    bitmap: ImageBitmap
    dither: boolean
    invert: boolean
}

/** @p pic fitted into at most w x h (aspect kept) -> the widget's image. */
function fitPicture(
    screens: ScreensApi,
    pic: Picture,
    w: number,
    h: number,
): ConfigScreenWidget['image'] {
    const k = Math.min(w / pic.bitmap.width, h / pic.bitmap.height, 1)
    const width = Math.max(1, Math.round(pic.bitmap.width * k))
    const height = Math.max(1, Math.round(pic.bitmap.height * k))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No 2D canvas')
    ctx.drawImage(pic.bitmap, 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)
    return screens.image(data, width, height, {
        dither: pic.dither,
        invert: pic.invert,
    })
}

function ImageField({
    screens,
    w,
    set,
    disabled,
    panel,
}: FieldsProps & { panel: Size }): JSX.Element {
    const input = useRef<HTMLInputElement>(null)
    const [pic, setPic] = useState<Picture | null>(null)
    const [error, setError] = useState<string | null>(null)
    const apply = (next: Picture): void => {
        setPic(next)
        // Fitted into the panel from the widget's corner (u8 sizes).
        const maxW = Math.min(screens.imageMax, panel.width - w.x)
        const maxH = Math.min(screens.imageMax, panel.height - w.y)
        const image = fitPicture(screens, next, maxW, maxH)
        if (image) set({ image, w: image.width, h: image.height })
    }
    const load = async (file: File | undefined): Promise<void> => {
        if (!file) return
        try {
            apply({
                bitmap: await createImageBitmap(file),
                dither: true,
                invert: false,
            })
            setError(null)
        } catch {
            setError('That file is not a picture this app can read.')
        }
    }
    return (
        <>
            <Row label="Picture">
                <input
                    ref={input}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void load(e.target.files?.[0])}
                />
                <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => input.current?.click()}
                >
                    <ImageUp className="size-3.5" />
                    {w.image ? 'Replace' : 'Upload'}
                </Button>
                {w.image && (
                    <span className="text-caption text-muted-foreground">
                        {w.image.width} × {w.image.height} px
                    </span>
                )}
            </Row>
            {pic && (
                <div className="grid grid-cols-2 gap-x-4">
                    <SwitchRow
                        label="Dither"
                        hint="Shades as dot patterns; off for line art."
                        checked={pic.dither}
                        disabled={disabled}
                        onChange={(dither) => apply({ ...pic, dither })}
                    />
                    <SwitchRow
                        label="Light the dark parts"
                        checked={pic.invert}
                        disabled={disabled}
                        onChange={(invert) => apply({ ...pic, invert })}
                    />
                </div>
            )}
            {error && <p className="text-caption text-destructive">{error}</p>}
        </>
    )
}

type Size = { width: number; height: number }

/* Kind -> its own fields (Dispatch Map). */
const KIND_FIELDS: Record<
    ConfigScreenWidget['kind'],
    (p: FieldsProps & { panel: Size }) => JSX.Element | null
> = {
    text: ({ w, set, disabled }) => (
        <Row label="Text">
            <Input
                aria-label="Text"
                value={w.text ?? ''}
                maxLength={255}
                disabled={disabled}
                onChange={(e) => set({ text: e.target.value })}
                className="h-8"
            />
        </Row>
    ),
    value: (p) => <SourceField {...p} />,
    bar: (p) => (
        <>
            <SourceField {...p} />
            <Row label="Full at">
                <Num
                    label="Max"
                    value={p.w.max ?? 100}
                    min={1}
                    max={65535}
                    disabled={p.disabled}
                    onChange={(max) => p.set({ max })}
                />
            </Row>
        </>
    ),
    clock: ({ w, set, disabled }) => (
        <Row label="Shows">
            <Segmented
                value={w.format ?? 'hm'}
                options={[
                    { value: 'hm', label: '14:05', disabled },
                    { value: 'hms', label: '14:05:09', disabled },
                    { value: 'date', label: 'Date', disabled },
                ]}
                onChange={(format) => set({ format })}
            />
        </Row>
    ),
    image: (p) => <ImageField {...p} />,
    rect: () => null,
}

/** Kinds that draw text. */
const TEXTUAL = new Set<ConfigScreenWidget['kind']>(['text', 'value', 'clock'])

export function WidgetFields({
    screens,
    w,
    set,
    disabled,
    panel,
}: FieldsProps & { panel: Size }): JSX.Element {
    const Kind = KIND_FIELDS[w.kind]
    const fixedSize = w.kind === 'image'
    return (
        <div className="flex flex-col gap-0.5">
            <Kind
                screens={screens}
                w={w}
                set={set}
                disabled={disabled}
                panel={panel}
            />
            <Row label="Box">
                <Num
                    label="X"
                    value={w.x}
                    min={0}
                    max={panel.width - 1}
                    disabled={disabled}
                    onChange={(x) => set({ x })}
                />
                <Num
                    label="Y"
                    value={w.y}
                    min={0}
                    max={panel.height - 1}
                    disabled={disabled}
                    onChange={(y) => set({ y })}
                />
                <Num
                    label="W"
                    value={w.w}
                    min={1}
                    max={panel.width}
                    disabled={disabled || fixedSize}
                    onChange={(v) => set({ w: v })}
                />
                <Num
                    label="H"
                    value={w.h}
                    min={1}
                    max={panel.height}
                    disabled={disabled || fixedSize}
                    onChange={(h) => set({ h })}
                />
            </Row>
            {TEXTUAL.has(w.kind) && (
                <Row label="Text look">
                    <Segmented
                        label="Font"
                        value={w.font ?? 'small'}
                        options={[
                            { value: 'small', label: 'Small', disabled },
                            { value: 'large', label: 'Large', disabled },
                        ]}
                        onChange={(font) => set({ font })}
                    />
                    <Segmented
                        label="Align"
                        value={w.align ?? 'left'}
                        options={[
                            { value: 'left', label: 'Left', disabled },
                            { value: 'centre', label: 'Centre', disabled },
                            { value: 'right', label: 'Right', disabled },
                        ]}
                        onChange={(align) => set({ align })}
                    />
                </Row>
            )}
            <div className="grid grid-cols-2 gap-x-4">
                <SwitchRow
                    label="Invert"
                    checked={!!w.invert}
                    disabled={disabled}
                    onChange={(invert) => set({ invert })}
                />
                <SwitchRow
                    label={w.kind === 'rect' ? 'Outline only' : 'Frame'}
                    checked={!!w.frame}
                    disabled={disabled}
                    onChange={(frame) => set({ frame })}
                />
            </div>
        </div>
    )
}
