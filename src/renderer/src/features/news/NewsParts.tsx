// pattern-check: skip — shared presentational pieces (tag badge, links, row wrapper) for the news layouts
//
// Small pieces every start-page news layout shares, built on the shadcn kit:
// a Badge for the tag, Button links for calls to action, and a row wrapper
// that `<Item asChild>` can render as a button or a link.
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { ArrowRight, Pin } from 'lucide-react'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { cn } from '@/lib/cn'
import useNewsStore from '@/stores/newsStore'
import { NEWS_TAGS, type NewsItem, type NewsTagId } from './newsModel'
import { newsTone } from './newsUi'

/** The pin that marks a pinned item. "Pinned" is its tooltip and screen-reader
 *  label, and shows as text instead if the icon fails to render. */
export function PinnedMark({
    size = 14,
    className,
    style,
}: {
    size?: number
    className?: string
    style?: CSSProperties
}): JSX.Element {
    return (
        <ErrorBoundary
            fallback={() => (
                <span className={className} style={style}>
                    Pinned
                </span>
            )}
        >
            <span
                role="img"
                aria-label="Pinned"
                title="Pinned"
                className={className}
                style={style}
            >
                <Pin size={size} aria-hidden />
            </span>
        </ErrorBoundary>
    )
}

/** The item's category, coloured by its tag (design: 10.5px bold caps pill). */
export function NewsTag({
    tag,
    solid,
}: {
    tag: NewsTagId
    solid?: boolean
}): JSX.Element {
    return (
        <Badge
            variant={solid ? 'tone-solid' : 'tone'}
            className="shrink-0 whitespace-nowrap rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase leading-none tracking-[.02em]"
            style={{ '--badge-tone': newsTone(tag) } as CSSProperties}
        >
            {NEWS_TAGS[tag].label}
        </Badge>
    )
}

// The design's text link: 12.5px semibold with a trailing arrow.
const LINK_CLASS = 'h-auto gap-[5px] px-0 text-[12.5px] font-semibold'

/** An external link styled as a link Button, with a trailing arrow. `tone`
 *  colours it with a news tag's colour; `muted` greys it out. */
export function NewsTextLink({
    href,
    children,
    arrow = true,
    tone,
    muted,
    className,
}: {
    href: string
    children: ReactNode
    arrow?: boolean
    tone?: string
    muted?: boolean
    className?: string
}): JSX.Element {
    return (
        <Button
            variant="link"
            size="sm"
            className={cn(
                LINK_CLASS,
                muted && 'text-muted-foreground',
                className,
            )}
            style={tone ? { color: tone } : undefined}
            asChild
        >
            <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
                {arrow && <ArrowRight />}
            </a>
        </Button>
    )
}

/** The item's call to action: opens the release notes for a release, the
 *  link for anything else, or nothing when there's neither. `tinted` uses the
 *  item's tag colour instead of the primary colour. */
export function NewsCta({
    item,
    tinted,
    className,
}: {
    item: NewsItem
    tinted?: boolean
    className?: string
}): JSX.Element | null {
    const openNotes = useNewsStore((s) => s.openNotes)
    const tone = tinted ? newsTone(item.tag) : undefined
    if (item.notes) {
        return (
            <Button
                variant="link"
                size="sm"
                className={cn(LINK_CLASS, className)}
                style={tone ? { color: tone } : undefined}
                onClick={() => openNotes(item.id)}
            >
                {item.cta ?? 'What’s in it'}
                <ArrowRight />
            </Button>
        )
    }
    if (!item.url) return null
    return (
        <NewsTextLink href={item.url} tone={tone} className={className}>
            {item.cta ?? 'Read more'}
        </NewsTextLink>
    )
}

/** Makes a news row clickable: a release opens its notes dialog, a linked item
 *  opens its url, anything else is plain. Meant for `<Item asChild>`, so it
 *  passes the props Item gives it on to whatever element it renders. */
export function NewsItemLink({
    item,
    onOpen,
    children,
    ...props
}: {
    item: NewsItem
    /** Runs on open as well, e.g. to mark the item read. */
    onOpen?: () => void
    children: ReactNode
} & Omit<ComponentProps<'div'>, 'onClick'>): JSX.Element {
    const openNotes = useNewsStore((s) => s.openNotes)
    if (item.notes) {
        return (
            <button
                type="button"
                {...(props as ComponentProps<'button'>)}
                className={cn('text-left', props.className)}
                onClick={() => {
                    onOpen?.()
                    openNotes(item.id)
                }}
            >
                {children}
            </button>
        )
    }
    if (item.url) {
        return (
            <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                {...(props as ComponentProps<'a'>)}
                onClick={onOpen}
            >
                {children}
            </a>
        )
    }
    if (onOpen) {
        return (
            <button
                type="button"
                {...(props as ComponentProps<'button'>)}
                className={cn('text-left', props.className)}
                onClick={onOpen}
            >
                {children}
            </button>
        )
    }
    return <div {...props}>{children}</div>
}
