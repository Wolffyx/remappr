// pattern-check: skip — presentational inbox (design F) on shadcn Popover + Button + Badge + ScrollArea + Item
import { useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from '@/ui/item'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { ScrollArea } from '@/ui/scroll-area'
import { CHANGELOG_URL } from '@/lib/constants'
import { cn } from '@/lib/cn'
import useNewsStore from '@/stores/newsStore'
import { NewsItemLink, NewsTextLink, PinnedMark } from './NewsParts'
import { NEWS_TAG_ICONS, newsTone } from './newsUi'
import {
    formatNewsDate,
    isUnread,
    NEWS_TAGS,
    type NewsItem,
    type NewsView,
} from './newsModel'

// Past this many rows the list scrolls inside a fixed height (design: 400px).
const SCROLL_AFTER = 6

/** A bell in the start-page header with an unread count; opens a list of all
 *  news. Opening an item marks it read. */
export function NewsBell({ pinned, latest }: NewsView): JSX.Element | null {
    const readIds = useNewsStore((s) => s.readIds)
    const markRead = useNewsStore((s) => s.markRead)
    const [open, setOpen] = useState(false)
    const items = useMemo(() => [...pinned, ...latest], [pinned, latest])
    if (!items.length) return null

    const now = new Date()
    const read = new Set(readIds)
    const unread = items.filter((n) => isUnread(n, read, now)).length

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative text-muted-foreground hover:text-foreground"
                    aria-label={
                        unread ? `What’s new, ${unread} unread` : 'What’s new'
                    }
                    title="What’s new"
                >
                    <Bell />
                    {unread > 0 && (
                        <Badge className="absolute right-[3px] top-[3px] h-4 min-w-4 justify-center rounded-full px-1 text-[10px] font-extrabold leading-none shadow-[0_0_0_2px_var(--background)]">
                            {unread}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                // Same surface as the app's other dialogs (bg-background),
                // not the lighter popover one the row dividers vanish on.
                className="w-[380px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[14px] bg-background p-0 text-foreground shadow-[0_24px_60px_-20px_rgba(0,0,0,.7)] focus-visible:outline-none"
                // Focus the panel, not its first button, so opening with the
                // mouse doesn't ring "Mark all read"; Tab still moves in.
                onOpenAutoFocus={(e) => {
                    e.preventDefault()
                    ;(e.currentTarget as HTMLElement | null)?.focus()
                }}
                tabIndex={-1}
            >
                <div className="flex items-center border-b border-border px-4 py-3">
                    <span className="flex-1 text-[14px] font-bold">
                        What’s new
                    </span>
                    <Button
                        variant="link"
                        size="sm"
                        className="h-auto px-0 text-[12px] font-semibold"
                        onClick={() => markRead(items.map((n) => n.id))}
                    >
                        Mark all read
                    </Button>
                </div>
                <ScrollArea
                    type="always"
                    className={cn(items.length > SCROLL_AFTER && 'h-[400px]')}
                >
                    {items.map((n) => (
                        <BellRow
                            key={n.id}
                            item={n}
                            unread={isUnread(n, read, now)}
                            now={now}
                            onOpen={() => {
                                markRead([n.id])
                                setOpen(false)
                            }}
                        />
                    ))}
                </ScrollArea>
                <div className="px-4 py-2.5">
                    <NewsTextLink href={CHANGELOG_URL}>
                        Full changelog
                    </NewsTextLink>
                </div>
            </PopoverContent>
        </Popover>
    )
}

function BellRow({
    item: n,
    unread,
    now,
    onOpen,
}: {
    item: NewsItem
    unread: boolean
    now: Date
    onOpen: () => void
}): JSX.Element {
    const c = newsTone(n.tag)
    const TagIcon = NEWS_TAG_ICONS[n.tag]
    return (
        <Item
            size="sm"
            className="w-full flex-nowrap items-start gap-3 rounded-none border-0 border-b border-border hover:bg-accent/40"
            style={
                n.pinned
                    ? {
                          background: `color-mix(in oklch, ${c} 7%, transparent)`,
                      }
                    : undefined
            }
            asChild
        >
            <NewsItemLink item={n} onOpen={onOpen}>
                <ItemMedia
                    variant="icon"
                    className="size-[30px] translate-y-0 rounded-lg border-0"
                    style={{
                        color: c,
                        background: `color-mix(in oklch, ${c} 14%, transparent)`,
                    }}
                >
                    {n.pinned ? <PinnedMark size={15} /> : <TagIcon />}
                </ItemMedia>
                <ItemContent className="gap-0.5">
                    <ItemDescription className="text-[11.5px] leading-normal">
                        {NEWS_TAGS[n.tag].label} · {formatNewsDate(n.date, now)}
                    </ItemDescription>
                    <ItemTitle
                        className={cn(
                            'w-auto text-[13px] leading-[1.35]',
                            unread ? 'font-bold' : 'font-medium',
                        )}
                    >
                        {n.title}
                    </ItemTitle>
                </ItemContent>
                {unread && (
                    <ItemActions className="pt-1.5">
                        <span
                            className="size-2 rounded-full bg-primary"
                            aria-label="Unread"
                        />
                    </ItemActions>
                )}
            </NewsItemLink>
        </Item>
    )
}
