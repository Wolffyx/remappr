<!--
  One release on the docs What's new page. The version is an h2 with an
  anchor, so it lands in the page outline and can be linked (#v0.0.16).
-->
<script setup lang="ts">
import type { ChangelogRelease } from '../data/releases.data'
import { formatDay } from '../data/formatDay'

defineProps<{ release: ChangelogRelease; latest: boolean }>()

const REPO = 'https://github.com/Wolffyx/remappr'

// release-please headings → what the page calls them; others show as-is.
const SECTION_LABEL: Record<string, string> = {
    Features: '✨ New features',
    'Bug Fixes': '🧩 Fixes',
    'Performance Improvements': '🚀 Performance',
    Reverts: '↩️ Reverts',
}

/** Split an entry so each "#149" can link to its issue. */
function parts(text: string): { text: string; issue?: string }[] {
    return text
        .split(/(#\d+)/)
        .filter(Boolean)
        .map((p) =>
            /^#\d+$/.test(p) ? { text: p, issue: p.slice(1) } : { text: p },
        )
}
</script>

<template>
    <section class="cl-release">
        <h2 :id="release.tag" tabindex="-1">
            {{ release.version }}
            <Badge v-if="latest" type="tip" text="Latest" />
            <a
                class="header-anchor"
                :href="`#${release.tag}`"
                :aria-label="`Permalink to ${release.version}`"
                >&#8203;</a
            >
        </h2>
        <p class="cl-meta">
            <span>{{ formatDay(release.publishedAt) }}</span>
            <span v-if="release.summary">{{ release.summary }}</span>
            <a :href="release.url" target="_blank" rel="noopener noreferrer"
                >View on GitHub</a
            >
        </p>
        <div v-for="s in release.sections" :key="s.title" class="cl-section">
            <p class="cl-section-title">
                {{ SECTION_LABEL[s.title] ?? s.title }}
            </p>
            <ul>
                <li v-for="e in s.entries" :key="`${e.scope ?? ''}|${e.text}`">
                    <code v-if="e.scope" class="cl-scope">{{ e.scope }}</code>
                    <template v-for="(p, k) in parts(e.text)" :key="k">
                        <a
                            v-if="p.issue"
                            :href="`${REPO}/issues/${p.issue}`"
                            target="_blank"
                            rel="noopener noreferrer"
                            >{{ p.text }}</a
                        >
                        <template v-else>{{ p.text }}</template>
                    </template>
                </li>
            </ul>
        </div>
        <p v-if="!release.sections.length" class="cl-empty">
            No notes were written for this release.
        </p>
    </section>
</template>

<style scoped>
.cl-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin: 4px 0 16px;
    font-size: 14px;
    color: var(--vp-c-text-2);
}
.cl-section-title {
    margin: 18px 0 6px;
    font-size: 15px;
    font-weight: 700;
}
.cl-section ul {
    margin: 0;
}
.cl-scope {
    margin-right: 6px;
    font-size: 12px;
}
.cl-empty {
    color: var(--vp-c-text-2);
}
</style>
