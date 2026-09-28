<!--
  The docs What's new page: pinned news.json items first, then one timeline,
  newest first, of the other news items and every published release — the
  same mix the app's start page shows. News comes from docs/public/news.json
  through the app's own news model; releases from the build-time loader.
-->
<script setup lang="ts">
import raw from '../../public/news.json'
import {
    mergeNews,
    type NewsItem,
    parseNewsFile,
} from '../../../src/renderer/src/features/news/newsModel'
import { type ChangelogRelease, data as releases } from '../data/releases.data'
import NewsCard from './NewsCard.vue'
import ReleaseEntry from './ReleaseEntry.vue'

const REPO = 'https://github.com/Wolffyx/remappr'

type Entry =
    | { kind: 'news'; at: number; item: NewsItem }
    | { kind: 'release'; at: number; release: ChangelogRelease }

const { pinned, latest } = mergeNews(
    parseNewsFile(raw),
    [],
    new Date(),
    Infinity,
)
const newestRelease = releases[0]?.tag
const timeline: Entry[] = [
    ...latest.map((item) => ({
        kind: 'news' as const,
        at: Date.parse(item.date),
        item,
    })),
    ...releases.map((release) => ({
        kind: 'release' as const,
        at: Date.parse(release.publishedAt),
        release,
    })),
].sort((a, b) => b.at - a.at)
</script>

<template>
    <div class="whats-new">
        <template v-if="pinned.length">
            <h2 id="pinned" tabindex="-1">
                Pinned
                <a
                    class="header-anchor"
                    href="#pinned"
                    aria-label="Permalink to Pinned"
                    >&#8203;</a
                >
            </h2>
            <NewsCard v-for="n in pinned" :key="n.id" :item="n" />
        </template>

        <template v-for="entry in timeline">
            <NewsCard
                v-if="entry.kind === 'news'"
                :key="entry.item.id"
                :item="entry.item"
            />
            <ReleaseEntry
                v-else
                :key="entry.release.tag"
                :release="entry.release"
                :latest="entry.release.tag === newestRelease"
            />
        </template>

        <p v-if="!releases.length" class="wn-note">
            The release list couldn’t be loaded when these docs were built.
            Every release is on
            <a
                :href="`${REPO}/releases`"
                target="_blank"
                rel="noopener noreferrer"
                >GitHub Releases</a
            >.
        </p>
    </div>
</template>

<style scoped>
/* The news tag tones come from the app's model, written against the app's
   theme variables; map them onto VitePress's. */
.whats-new {
    --primary: var(--vp-c-brand-1);
    --news-tone-l: 0.56;
}
:global(html.dark) .whats-new {
    --news-tone-l: 0.74;
}
.wn-note {
    color: var(--vp-c-text-2);
}
</style>
