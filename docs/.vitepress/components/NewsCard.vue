<!-- One news.json item on the docs What's new page. -->
<script setup lang="ts">
import {
    NEWS_TAGS,
    type NewsItem,
} from '../../../src/renderer/src/features/news/newsModel'
import { formatDay } from '../data/formatDay'

defineProps<{ item: NewsItem }>()
</script>

<template>
    <article
        :id="item.id"
        class="news-item"
        :style="{ '--tone': NEWS_TAGS[item.tag].tone }"
    >
        <div class="news-meta">
            <span class="news-tag">{{ NEWS_TAGS[item.tag].label }}</span>
            <span>{{ formatDay(item.date) }}</span>
            <span v-if="item.version" class="news-version">{{
                item.version
            }}</span>
        </div>
        <div class="news-title">{{ item.title }}</div>
        <p v-if="item.body" class="news-body">{{ item.body }}</p>
        <a
            v-if="item.url"
            class="news-cta"
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            >{{ item.cta ?? 'Read more' }} →</a
        >
    </article>
</template>

<style scoped>
.news-item {
    margin: 16px 0;
    padding: 16px 18px;
    border: 1px solid color-mix(in oklch, var(--tone) 30%, var(--vp-c-divider));
    border-radius: 12px;
    background: linear-gradient(
        160deg,
        color-mix(in oklch, var(--tone) 8%, var(--vp-c-bg-soft)),
        var(--vp-c-bg-soft) 65%
    );
}
.news-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
    color: var(--vp-c-text-2);
}
.news-tag {
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--tone);
    background: color-mix(in oklch, var(--tone) 15%, transparent);
}
.news-version {
    font-family: var(--vp-font-family-mono);
}
.news-title {
    margin-top: 8px;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
}
.news-body {
    margin: 4px 0 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--vp-c-text-2);
}
.news-cta {
    display: inline-block;
    margin-top: 8px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--tone);
    text-decoration: none;
}
.news-cta:hover {
    text-decoration: underline;
}
</style>
