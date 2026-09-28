// pattern-check: skip — plain string constants, no abstraction
export const GITHUB_OWNER = 'Wolffyx'
export const GITHUB_REPO = 'remappr'
export const REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
export const DISCORD_URL = 'https://discord.gg/asJ7bCCMzW'
export const DOCS_URL = 'https://docs.remappr.com'
// Start-page news: the hand-written docs/public/news.json on main (edits ship
// without an app release; the docs site publishes the same file) and the
// release list it sits beside. Raw GitHub serves it with open CORS.
export const NEWS_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/docs/public/news.json`
export const CHANGELOG_URL = `${DOCS_URL}/whats-new`
export const RELEASES_FEED_URL = `${REPO_URL}/releases.atom`
// Donation links surfaced in the "Support this project" dialog. GitHub Sponsors
// derives from the repo owner; the Ko-fi handle / Open Collective slug are
// placeholders — confirm the real ones before release.
export const GITHUB_SPONSORS_URL = `https://github.com/sponsors/${GITHUB_OWNER}`
export const KOFI_URL = 'https://ko-fi.com/wolffyx'
export const OPENCOLLECTIVE_URL = 'https://opencollective.com/remappr'
export const APP_VERSION =
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
