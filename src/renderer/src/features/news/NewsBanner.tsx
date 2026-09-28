// pattern-check: skip — presentational banner composed from shadcn Alert + Button
import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert'
import { Button } from '@/ui/button'
import useNewsStore from '@/stores/newsStore'
import { NewsCta, PinnedMark } from './NewsParts'
import { newsTone } from './newsUi'
import type { NewsItem } from './newsModel'

/** A full-width strip of pinned items, one at a time, with paging and a
 *  dismiss. Dismissing hides the items shown; a newly pinned one brings the
 *  banner back. */
export function NewsBanner({
    pinned,
}: {
    pinned: NewsItem[]
}): JSX.Element | null {
    const dismissed = useNewsStore((s) => s.dismissedBannerIds)
    const dismiss = useNewsStore((s) => s.dismissBanner)
    const [index, setIndex] = useState(0)
    const items = pinned.filter((n) => !dismissed.includes(n.id))
    if (!items.length) return null

    const i = index % items.length
    const n = items[i]
    const c = newsTone(n.tag)
    const step = (by: number): void =>
        setIndex((i + by + items.length) % items.length)

    return (
        <Alert
            className="relative z-[3] flex shrink-0 flex-wrap items-center gap-3 rounded-none border-x-0 border-t-0 px-5 py-2.5"
            style={{
                background: `color-mix(in oklch, ${c} 12%, var(--background))`,
                borderColor: `color-mix(in oklch, ${c} 30%, var(--border))`,
            }}
        >
            <PinnedMark size={14} style={{ color: c }} />
            <div className="min-w-0 flex-[1_1_300px] text-[13.5px]">
                <AlertTitle className="mb-0 inline font-bold tracking-normal">
                    {n.title}
                </AlertTitle>
                {n.body && (
                    <AlertDescription className="inline text-[13.5px] text-muted-foreground">
                        {' — '}
                        {n.body}
                    </AlertDescription>
                )}
            </div>
            <NewsCta item={n} tinted />
            <div className="flex items-center gap-0.5">
                {items.length > 1 && (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="Previous pinned item"
                            onClick={() => step(-1)}
                        >
                            <ChevronLeft />
                        </Button>
                        <span className="font-mono text-[11px] text-muted-foreground">
                            {i + 1}/{items.length}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="Next pinned item"
                            onClick={() => step(1)}
                        >
                            <ChevronRight />
                        </Button>
                    </>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Dismiss"
                    title="Dismiss"
                    onClick={() => dismiss(items.map((x) => x.id))}
                >
                    <X />
                </Button>
            </div>
        </Alert>
    )
}
