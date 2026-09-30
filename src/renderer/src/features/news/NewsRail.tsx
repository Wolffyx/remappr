// pattern-check: skip — presentational rail (design C): tinted shadcn Cards for pinned items + a timeline
import { Card, CardDescription, CardTitle } from '@/ui/card'
import { CHANGELOG_URL } from '@/lib/constants'
import {
    NewsCta,
    NewsItemLink,
    NewsTag,
    NewsTextLink,
    PinnedMark,
} from './NewsParts'
import { NEWS_MONO, newsTone } from './newsUi'
import { formatNewsDate, NEWS_TAGS, type NewsView } from './newsModel'

const railHeading =
    'flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-muted-foreground'

/** A sticky column beside the device card: pinned cards, then a timeline of
 *  the latest items. */
export function NewsRail({ pinned, latest }: NewsView): JSX.Element | null {
    if (!pinned.length && !latest.length) return null
    const now = new Date()

    return (
        <aside className="fade-in sticky top-5 flex min-w-0 max-w-[720px] flex-[1_1_300px] flex-col gap-3 self-start">
            {pinned.length > 0 && (
                <div className={railHeading}>
                    <PinnedMark size={13} />
                </div>
            )}
            {pinned.map((n) => {
                const c = newsTone(n.tag)
                return (
                    <Card
                        key={n.id}
                        className="rounded-[14px] p-4 shadow-none"
                        style={{
                            borderColor: `color-mix(in oklch, ${c} 35%, var(--border))`,
                            background: `linear-gradient(160deg, color-mix(in oklch, ${c} 12%, var(--card)), var(--card) 65%)`,
                        }}
                    >
                        <div className="mb-2 flex items-center gap-2">
                            <NewsTag tag={n.tag} />
                            <span className="ml-auto text-[12px] text-muted-foreground">
                                {formatNewsDate(n.date, now)}
                            </span>
                        </div>
                        <CardTitle className="mb-1 text-[14.5px] font-bold leading-[1.3] tracking-normal">
                            {n.title}
                        </CardTitle>
                        {n.body && (
                            <CardDescription className="mb-2.5 text-[12.5px] leading-normal">
                                {n.body}
                            </CardDescription>
                        )}
                        <NewsCta item={n} tinted />
                    </Card>
                )
            })}

            {latest.length > 0 && (
                <>
                    <div className={`${railHeading} mt-2`}>Latest updates</div>
                    <ol className="relative pl-5">
                        <span className="absolute bottom-1.5 left-1 top-1.5 w-px bg-border" />
                        {latest.map((n) => (
                            <li key={n.id} className="relative pb-4">
                                <span
                                    className="absolute -left-5 top-1 size-[9px] rounded-full"
                                    style={{
                                        background: newsTone(n.tag),
                                        boxShadow:
                                            '0 0 0 3px var(--background)',
                                    }}
                                />
                                <div className="flex items-baseline gap-2 text-[11.5px] text-muted-foreground">
                                    <span
                                        className="font-bold"
                                        style={{ color: newsTone(n.tag) }}
                                    >
                                        {NEWS_TAGS[n.tag].label}
                                    </span>
                                    <span>{formatNewsDate(n.date, now)}</span>
                                    {n.version && !n.notes && (
                                        <span style={{ fontFamily: NEWS_MONO }}>
                                            {n.version}
                                        </span>
                                    )}
                                </div>
                                <NewsItemLink
                                    item={n}
                                    className="mt-0.5 block text-[13.5px] font-semibold leading-[1.35] hover:underline"
                                >
                                    {n.title}
                                </NewsItemLink>
                            </li>
                        ))}
                    </ol>
                </>
            )}
            <NewsTextLink href={CHANGELOG_URL} className="self-start">
                Full changelog
            </NewsTextLink>
        </aside>
    )
}
