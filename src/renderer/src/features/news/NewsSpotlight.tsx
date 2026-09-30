// pattern-check: skip — presentational spotlight (design D) on shadcn Carousel + Card + Button
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/ui/button'
import { Card, CardDescription, CardTitle } from '@/ui/card'
import {
    Carousel,
    type CarouselApi,
    CarouselContent,
    CarouselItem,
} from '@/ui/carousel'
import { cn } from '@/lib/cn'
import useNewsStore from '@/stores/newsStore'
import { NewsTag, PinnedMark } from './NewsParts'
import { NEWS_TAG_ICONS, newsTone } from './newsUi'
import { formatNewsDate, type NewsItem, type NewsView } from './newsModel'

const ROTATE_MS = 6000

/** A large card above the devices that cycles through the pinned items and
 *  the newest update. Pauses while hovered. */
export function NewsSpotlight({
    pinned,
    latest,
}: NewsView): JSX.Element | null {
    const items = latest[0] ? [...pinned, latest[0]] : pinned
    const [api, setApi] = useState<CarouselApi>()
    const [current, setCurrent] = useState(0)
    const [hover, setHover] = useState(false)

    useEffect(() => {
        if (!api) return
        const onSelect = (): void => setCurrent(api.selectedScrollSnap())
        onSelect()
        api.on('select', onSelect)
        return () => {
            api.off('select', onSelect)
        }
    }, [api])

    useEffect(() => {
        if (!api || hover || items.length < 2) return
        const t = setInterval(() => api.scrollNext(), ROTATE_MS)
        return () => clearInterval(t)
    }, [api, hover, items.length])

    if (!items.length) return null

    const dots =
        items.length > 1 ? (
            <div className="ml-auto flex gap-1.5">
                {items.map((x, k) => (
                    <button
                        key={x.id}
                        type="button"
                        aria-label={`Show ${x.title}`}
                        aria-current={k === current}
                        onClick={() => api?.scrollTo(k)}
                        className={cn(
                            'h-[7px] rounded-full p-0 transition-[width] duration-200',
                            k === current ? 'w-5' : 'w-[7px]',
                        )}
                        style={{
                            background:
                                k === current
                                    ? newsTone(items[current].tag)
                                    : 'color-mix(in oklch, var(--foreground) 22%, transparent)',
                        }}
                    />
                ))}
            </div>
        ) : null

    return (
        <Carousel
            setApi={setApi}
            opts={{ loop: true }}
            className="fade-in mb-4 w-full"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <CarouselContent>
                {items.map((n) => (
                    <CarouselItem key={n.id}>
                        <SpotlightCard item={n} dots={dots} />
                    </CarouselItem>
                ))}
            </CarouselContent>
        </Carousel>
    )
}

function SpotlightCard({
    item: n,
    dots,
}: {
    item: NewsItem
    dots: ReactNode
}): JSX.Element {
    const openNotes = useNewsStore((s) => s.openNotes)
    const c = newsTone(n.tag)
    const TagIcon = NEWS_TAG_ICONS[n.tag]

    return (
        <Card
            className="grid h-full grid-cols-[repeat(auto-fit,minmax(240px,1fr))] overflow-hidden rounded-2xl shadow-none"
            style={{
                borderColor: `color-mix(in oklch, ${c} 35%, var(--border))`,
            }}
        >
            {n.image ? (
                <img
                    src={n.image}
                    alt=""
                    className="h-full min-h-[170px] w-full object-cover"
                />
            ) : (
                // Cover art stand-in: the tag's icon on a striped field.
                <div
                    className="grid min-h-[170px] place-items-center"
                    style={{
                        color: c,
                        background: `repeating-linear-gradient(135deg, color-mix(in oklch, ${c} 14%, var(--card)) 0 10px, color-mix(in oklch, ${c} 8%, var(--card)) 10px 20px)`,
                    }}
                >
                    <TagIcon size={40} strokeWidth={1.6} />
                </div>
            )}
            <div className="flex flex-col gap-2 p-5">
                <div className="flex items-center gap-2">
                    {n.pinned && <PinnedMark style={{ color: c }} />}
                    <NewsTag tag={n.tag} solid />
                    <span className="text-[12px] text-muted-foreground">
                        {formatNewsDate(n.date, new Date())}
                        {n.version && !n.notes ? ` · ${n.version}` : ''}
                    </span>
                </div>
                <CardTitle className="text-pretty text-[19px] font-extrabold leading-[1.2] tracking-[-.015em]">
                    {n.title}
                </CardTitle>
                {n.body && (
                    <CardDescription className="text-[13.5px] leading-normal">
                        {n.body}
                    </CardDescription>
                )}
                <div className="mt-auto flex items-center gap-3 pt-1.5">
                    {n.notes && (
                        <Button
                            variant="secondary"
                            className="h-auto border border-border px-3.5 py-2 text-[13px] font-semibold"
                            onClick={() => openNotes(n.id)}
                        >
                            {n.cta ?? 'What’s in it'}
                        </Button>
                    )}
                    {!n.notes && n.url && (
                        <Button
                            variant="secondary"
                            className="h-auto border border-border px-3.5 py-2 text-[13px] font-semibold"
                            asChild
                        >
                            <a
                                href={n.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {n.cta ?? 'Read notes'}
                            </a>
                        </Button>
                    )}
                    {dots}
                </div>
            </div>
        </Card>
    )
}
