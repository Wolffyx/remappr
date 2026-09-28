// Pattern check: Dispatch Map (Tier 0) — extended — keeps the feed's filter table (label + match predicate); design B styling on shadcn Card, ToggleGroup and Empty.
import { useState } from 'react'
import { Rss } from 'lucide-react'
import { Card, CardDescription, CardTitle } from '@/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/ui/empty'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { CHANGELOG_URL, RELEASES_FEED_URL } from '@/lib/constants'
import {
    NewsCta,
    NewsItemLink,
    NewsTag,
    NewsTextLink,
    PinnedMark,
} from './NewsParts'
import { NEWS_MONO, newsTone } from './newsUi'
import { formatNewsDate, type NewsItem, type NewsView } from './newsModel'

type FeedFilter = 'all' | 'release' | 'firmware' | 'community'

const FILTERS: {
    id: FeedFilter
    label: string
    match: (n: NewsItem) => boolean
}[] = [
    { id: 'all', label: 'All', match: () => true },
    {
        id: 'release',
        label: 'Releases',
        match: (n) => n.tag === 'release' || n.tag === 'fix',
    },
    { id: 'firmware', label: 'Firmware', match: (n) => n.tag === 'firmware' },
    {
        id: 'community',
        label: 'Community',
        match: (n) => n.tag === 'community',
    },
]

/** "What's new" card below the start-page cards: pinned rows on top, then a
 *  filterable list of the latest items. */
export function NewsFeed({ pinned, latest }: NewsView): JSX.Element | null {
    const [filter, setFilter] = useState<FeedFilter>('all')
    if (!pinned.length && !latest.length) return null

    const now = new Date()
    const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0]
    const list = latest.filter(active.match)

    return (
        <Card className="fade-in mt-4 w-full overflow-hidden rounded-2xl shadow-none">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
                <div className="flex-1">
                    <CardTitle className="text-[15px] font-bold tracking-normal">
                        What’s new
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-[13px]">
                        Releases, firmware support and announcements
                    </CardDescription>
                </div>
                <ToggleGroup
                    type="single"
                    value={filter}
                    onValueChange={(v) => v && setFilter(v as FeedFilter)}
                    aria-label="Filter news"
                    className="gap-1 rounded-[9px] border border-border bg-secondary p-[3px]"
                >
                    {FILTERS.map((f) => (
                        <ToggleGroupItem
                            key={f.id}
                            value={f.id}
                            className="h-auto min-w-0 rounded-[7px] px-2.5 py-[5px] text-[12px] font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_3px_rgba(0,0,0,.25)]"
                        >
                            {f.label}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>

            {filter === 'all' &&
                pinned.map((n) => (
                    <div
                        key={n.id}
                        className="flex gap-3.5 border-b border-border px-5 py-3.5"
                        style={{
                            background: `color-mix(in oklch, ${newsTone(n.tag)} 8%, transparent)`,
                        }}
                    >
                        <PinnedMark
                            size={16}
                            className="pt-0.5"
                            style={{ color: newsTone(n.tag) }}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                                <NewsTag tag={n.tag} />
                                <span className="text-[12px] text-muted-foreground">
                                    {formatNewsDate(n.date, now)}
                                </span>
                            </div>
                            <div className="text-[14px] font-bold">
                                {n.title}
                            </div>
                            {n.body && (
                                <div className="mt-0.5 text-[13px] leading-normal text-muted-foreground">
                                    {n.body}
                                </div>
                            )}
                        </div>
                        <NewsCta item={n} className="self-center" />
                    </div>
                ))}

            {list.map((n) => (
                <NewsItemLink
                    key={n.id}
                    item={n}
                    className="grid w-full grid-cols-[112px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-border px-5 py-[13px] transition-colors hover:bg-accent/40"
                >
                    <span className="justify-self-start">
                        <NewsTag tag={n.tag} />
                    </span>
                    <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold">
                            {n.version && !n.notes && (
                                <span
                                    className="mr-1.5 text-muted-foreground"
                                    style={{ fontFamily: NEWS_MONO }}
                                >
                                    {n.version}
                                </span>
                            )}
                            {n.title}
                        </div>
                        {n.body && (
                            <div className="mt-0.5 text-pretty text-[12.5px] leading-normal text-muted-foreground">
                                {n.body}
                            </div>
                        )}
                    </div>
                    <span className="text-[12px] text-muted-foreground">
                        {formatNewsDate(n.date, now)}
                    </span>
                </NewsItemLink>
            ))}
            {!list.length && (
                <Empty className="border-b border-border p-6 md:p-6">
                    <EmptyHeader>
                        <EmptyTitle className="text-sm">
                            Nothing here yet
                        </EmptyTitle>
                        <EmptyDescription>
                            No {active.label.toLowerCase()} news right now.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}

            <div className="flex justify-between px-5 py-3">
                <NewsTextLink href={CHANGELOG_URL}>Full changelog</NewsTextLink>
                <NewsTextLink href={RELEASES_FEED_URL} arrow={false} muted>
                    <Rss />
                    RSS
                </NewsTextLink>
            </div>
        </Card>
    )
}
