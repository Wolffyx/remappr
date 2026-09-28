// pattern-check: skip — presentational chip (design E) on shadcn Collapsible + Button + Badge + Card
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/ui/collapsible'
import { CHANGELOG_URL } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { NewsItemLink, NewsTextLink, PinnedMark } from './NewsParts'
import { NEWS_MONO, newsTone } from './newsUi'
import { formatNewsDate, type NewsView } from './newsModel'

/** Replaces the hero's compatibility badge with a "NEW" pill for the newest
 *  item; opening it shows every pinned item and the three newest updates.
 *  With no news it shows `fallback` (the badge) instead. */
export function NewsChip({
    pinned,
    latest,
    fallback,
}: NewsView & { fallback: ReactNode }): JSX.Element {
    const [open, setOpen] = useState(false)
    const head = latest[0] ?? pinned[0]
    if (!head) return <>{fallback}</>

    const now = new Date()
    const recent = [...pinned, ...latest.slice(0, 3)]

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="mb-5 flex flex-col items-center"
        >
            <CollapsibleTrigger asChild>
                <Button
                    variant="outline"
                    className="h-auto max-w-full gap-[9px] rounded-full bg-card py-1 pl-1 pr-3 text-[12.5px] font-semibold shadow-none"
                    style={{
                        borderColor:
                            'color-mix(in oklch, var(--primary) 35%, var(--border))',
                    }}
                >
                    <Badge className="rounded-full px-2 py-[3px] text-[10.5px] font-extrabold leading-none shadow-none">
                        NEW
                    </Badge>
                    {head.version && !head.notes && (
                        <span
                            className="text-muted-foreground"
                            style={{ fontFamily: NEWS_MONO }}
                        >
                            {head.version}
                        </span>
                    )}
                    <span className="truncate">{head.title}</span>
                    <ChevronDown
                        className={cn(
                            'text-muted-foreground transition-transform duration-150',
                            open && 'rotate-180',
                        )}
                    />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2.5 w-[440px] max-w-full text-left">
                <Card className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(0,0,0,.6)]">
                    {recent.map((x) => (
                        <NewsItemLink
                            key={x.id}
                            item={x}
                            className="flex w-full items-baseline gap-2.5 border-b border-border px-3.5 py-2.5 transition-colors hover:bg-accent/40"
                        >
                            {x.pinned ? (
                                <PinnedMark
                                    size={12}
                                    className="shrink-0 self-center"
                                    style={{ color: newsTone(x.tag) }}
                                />
                            ) : (
                                <span
                                    className="size-[7px] shrink-0 -translate-y-px rounded-full"
                                    style={{ background: newsTone(x.tag) }}
                                />
                            )}
                            <span className="flex-1 text-[13px] font-semibold">
                                {x.title}
                            </span>
                            <span className="text-[12px] text-muted-foreground">
                                {formatNewsDate(x.date, now)}
                            </span>
                        </NewsItemLink>
                    ))}
                    <div className="px-3.5 py-2.5">
                        <NewsTextLink href={CHANGELOG_URL}>
                            Full changelog
                        </NewsTextLink>
                    </div>
                </Card>
            </CollapsibleContent>
        </Collapsible>
    )
}
