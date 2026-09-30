// Pattern check: Dispatch Map (Tier 0) — extended — tag→icon table and the merged-news hook, split from NewsParts.tsx so that file only exports components.
import { useMemo } from 'react'
import {
    Check,
    Cpu,
    Lightbulb,
    type LucideIcon,
    Megaphone,
    Rocket,
    Sparkles,
} from 'lucide-react'
import useNewsStore from '@/stores/newsStore'
import {
    mergeNews,
    NEWS_TAGS,
    type NewsTagId,
    type NewsView,
} from './newsModel'

export const NEWS_TAG_ICONS: Record<NewsTagId, LucideIcon> = {
    announcement: Megaphone,
    release: Rocket,
    firmware: Cpu,
    fix: Check,
    notice: Lightbulb,
    community: Sparkles,
}

export const newsTone = (tag: NewsTagId): string => NEWS_TAGS[tag].tone

export const NEWS_MONO = "'JetBrains Mono', monospace"

/** Card surface shared by the feed, chip, rail and spotlight. */
export const newsCardClass =
    'overflow-hidden rounded-2xl border border-border bg-card'

/** Both sources merged into what the start page shows. */
export function useNews(): NewsView {
    const curated = useNewsStore((s) => s.curated)
    const releases = useNewsStore((s) => s.releases)
    return useMemo(
        () => mergeNews(curated, releases, new Date()),
        [curated, releases],
    )
}
