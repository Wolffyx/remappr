// Pattern check: Dispatch Map (Tier 0) — extended — keeps the section-heading→tone table; body recomposed from shadcn Dialog, ScrollArea, Separator and Badge.
import type { CSSProperties } from 'react'
import { Badge } from '@/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/ui/dialog'
import { ScrollArea } from '@/ui/scroll-area'
import { Separator } from '@/ui/separator'
import { CHANGELOG_URL } from '@/lib/constants'
import useNewsStore from '@/stores/newsStore'
import { NewsTag, NewsTextLink } from './NewsParts'
import {
    formatNewsDate,
    NEWS_TAGS,
    type NewsItem,
    type NewsView,
} from './newsModel'

const SECTION_TONE: Record<string, string> = {
    Features: NEWS_TAGS.release.tone,
    'Bug Fixes': NEWS_TAGS.fix.tone,
    'Performance Improvements': NEWS_TAGS.firmware.tone,
}
const OTHER_TONE = 'var(--muted-foreground)'

/** Everything in one release, grouped the way its notes are. Opened from any
 *  release item on the start page (newsStore.openNotes). */
export function ReleaseNotesDialog({ pinned, latest }: NewsView): JSX.Element {
    const notesItemId = useNewsStore((s) => s.notesItemId)
    const closeNotes = useNewsStore((s) => s.closeNotes)
    const item = [...pinned, ...latest].find((n) => n.id === notesItemId)
    return <ReleaseNotesView item={item} onClose={closeNotes} />
}

/** The release notes dialog for `item`; closed while it's undefined. A
 *  release item is titled by its version, anything else by its title. */
export function ReleaseNotesView({
    item,
    onClose,
}: {
    item: NewsItem | null | undefined
    onClose: () => void
}): JSX.Element {
    const sections = item?.notes ?? []
    const version = item?.version?.replace(/^v/, '')

    return (
        <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
            {item && (
                <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-0 p-0">
                    <DialogHeader className="gap-1.5 px-6 pb-4 pt-5 text-left">
                        <div className="flex items-center gap-2">
                            <NewsTag tag={item.tag} />
                            <span className="text-xs text-muted-foreground">
                                {formatNewsDate(item.date, new Date())}
                            </span>
                        </div>
                        <DialogTitle className="text-xl">
                            {version ? `Version ${version}` : item.title}
                        </DialogTitle>
                        <DialogDescription>
                            {item.body ||
                                'No notes were written for this release.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Separator />

                    <ScrollArea className="min-h-0 flex-1">
                        <div className="flex flex-col gap-5 px-6 py-4">
                            {sections.map((section) => (
                                <section
                                    key={section.title}
                                    className="flex flex-col gap-2"
                                    style={
                                        {
                                            '--badge-tone':
                                                SECTION_TONE[section.title] ??
                                                OTHER_TONE,
                                        } as CSSProperties
                                    }
                                >
                                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {section.title}
                                        <Badge
                                            variant="tone"
                                            className="rounded-full"
                                        >
                                            {section.entries.length}
                                        </Badge>
                                    </h4>
                                    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug marker:text-[var(--badge-tone)]">
                                        {section.entries.map((entry) => (
                                            <li
                                                key={`${entry.scope ?? ''}|${entry.text}`}
                                                className="[overflow-wrap:anywhere]"
                                            >
                                                {entry.scope && (
                                                    <Badge
                                                        variant="outline"
                                                        className="mr-1.5 font-mono font-normal"
                                                    >
                                                        {entry.scope}
                                                    </Badge>
                                                )}
                                                {entry.text}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    </ScrollArea>

                    <Separator />
                    <DialogFooter className="flex-row items-center justify-between px-6 py-3 sm:justify-between">
                        {item.url ? (
                            <NewsTextLink href={item.url}>
                                View on GitHub
                            </NewsTextLink>
                        ) : (
                            <span />
                        )}
                        <NewsTextLink
                            href={
                                item.version
                                    ? `${CHANGELOG_URL}#${item.version}`
                                    : CHANGELOG_URL
                            }
                        >
                            All releases
                        </NewsTextLink>
                    </DialogFooter>
                </DialogContent>
            )}
        </Dialog>
    )
}
