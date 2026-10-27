// Serves delivered builder packages same-origin under /_pkg/ from Cache
// Storage "remappr-pkg-v1" (the page verifies and fills that cache, and checks
// every file against its signed manifest before it loads it). Everything else
// goes to the network untouched.
const CACHE = 'remappr-pkg-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)
    if (url.origin !== self.location.origin || !url.pathname.startsWith('/_pkg/')) return
    event.respondWith(
        caches
            .open(CACHE)
            .then((cache) => cache.match(url.pathname))
            .then((hit) => hit ?? fetch(event.request)),
    )
})
