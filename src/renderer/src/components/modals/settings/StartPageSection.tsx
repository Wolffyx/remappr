// Pattern check: no GoF pattern (-) — rejected — shadcn RadioGroup choice cards (FieldLabel + Field + RadioGroupItem) bound to a store field; no abstraction warranted.
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group'
import { Switch } from '@/ui/switch'
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldTitle,
} from '@/ui/field'
import { cn } from '@/lib/cn'
import useNewsStore from '@/stores/newsStore'
import useUserSettingsStore, {
    type NewsStyle,
} from '@/stores/userSettingsStore'

// Each schematic is a tiny start page: the primary block is the device card,
// the foreground blocks are where the news goes.
const device = <div className="w-full flex-1 rounded bg-primary/25" />
const news = 'rounded bg-foreground/30'

const LAYOUTS: {
    value: NewsStyle
    label: string
    blurb: string
    schematic: JSX.Element
}[] = [
    {
        value: 'rail',
        label: 'Side rail',
        blurb: 'Pinned cards and a timeline in a column beside the devices.',
        schematic: (
            <div className="flex h-full w-full gap-1 p-1.5">
                {device}
                <div className={cn(news, 'w-4')} />
            </div>
        ),
    },
    {
        value: 'feed',
        label: 'What’s new feed',
        blurb: 'A filterable card of updates below the device list.',
        schematic: (
            <div className="flex h-full w-full flex-col gap-1 p-1.5">
                {device}
                <div className={cn(news, 'h-4')} />
            </div>
        ),
    },
    {
        value: 'spotlight',
        label: 'Spotlight',
        blurb: 'A large card above the devices that rotates through news.',
        schematic: (
            <div className="flex h-full w-full flex-col gap-1 p-1.5">
                <div className={cn(news, 'h-5')} />
                {device}
            </div>
        ),
    },
    {
        value: 'banner',
        label: 'Pinned banner',
        blurb: 'Only a strip with the pinned items at the top of the page.',
        schematic: (
            <div className="flex h-full w-full flex-col gap-1 p-1.5">
                <div className={cn(news, 'h-1.5')} />
                {device}
            </div>
        ),
    },
    {
        value: 'chip',
        label: '“New” chip',
        blurb: 'A small badge above the title that expands into recent news.',
        schematic: (
            <div className="flex h-full w-full flex-col items-center gap-1 p-1.5">
                <div className={cn(news, 'h-1.5 w-8 rounded-full')} />
                {device}
            </div>
        ),
    },
    {
        value: 'inbox',
        label: 'Bell inbox',
        blurb: 'A bell in the header with an unread count.',
        schematic: (
            <div className="flex h-full w-full flex-col gap-1 p-1.5">
                <div className="flex justify-end">
                    <div className={cn(news, 'size-1.5 rounded-full')} />
                </div>
                {device}
            </div>
        ),
    },
    {
        value: 'none',
        label: 'Off',
        blurb: 'No news on the start page.',
        schematic: <div className="flex h-full w-full p-1.5">{device}</div>,
    },
]

export function StartPageSection(): JSX.Element {
    const newsStyle = useUserSettingsStore((s) => s.newsStyle)
    const setNewsStyle = useUserSettingsStore((s) => s.setNewsStyle)
    const pinnedBanner = useUserSettingsStore((s) => s.newsPinnedBanner)
    const setPinnedBanner = useUserSettingsStore((s) => s.setNewsPinnedBanner)
    const resetBanner = useNewsStore((s) => s.resetBanner)

    // A new choice brings a dismissed banner back so the user sees it.
    const pickLayout = (value: NewsStyle): void => {
        setNewsStyle(value)
        resetBanner()
    }
    const toggleBanner = (on: boolean): void => {
        setPinnedBanner(on)
        resetBanner()
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
                <div>
                    <h3 className="text-lg font-semibold">News</h3>
                    <p className="text-sm text-muted-foreground">
                        How releases and announcements show on the start page.
                    </p>
                </div>
                <RadioGroup
                    value={newsStyle}
                    onValueChange={(v) => pickLayout(v as NewsStyle)}
                    aria-label="News layout"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                >
                    {LAYOUTS.map(({ value, label, blurb, schematic }) => (
                        <FieldLabel
                            key={value}
                            htmlFor={`news-layout-${value}`}
                        >
                            <Field>
                                <div className="flex items-center justify-between gap-2">
                                    <FieldTitle>{label}</FieldTitle>
                                    <RadioGroupItem
                                        value={value}
                                        id={`news-layout-${value}`}
                                    />
                                </div>
                                <div className="h-16 rounded-lg bg-accent/30">
                                    {schematic}
                                </div>
                                <FieldDescription>{blurb}</FieldDescription>
                            </Field>
                        </FieldLabel>
                    ))}
                </RadioGroup>
            </div>

            <FieldGroup>
                <FieldLabel htmlFor="news-pinned-banner">
                    <Field orientation="horizontal">
                        <FieldContent>
                            <FieldTitle>Also show the pinned banner</FieldTitle>
                            <FieldDescription>
                                Keep pinned announcements in a strip at the top
                                of the start page, whichever layout you pick.
                            </FieldDescription>
                        </FieldContent>
                        <Switch
                            id="news-pinned-banner"
                            checked={pinnedBanner || newsStyle === 'banner'}
                            disabled={newsStyle === 'banner'}
                            onCheckedChange={toggleBanner}
                        />
                    </Field>
                </FieldLabel>
            </FieldGroup>
        </div>
    )
}
