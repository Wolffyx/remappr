// pattern-check: skip — one date-formatting helper shared by the docs What's new page
/** "26 Aug 2026", read in UTC so a YYYY-MM-DD news date keeps its day. */
export const formatDay = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    })
