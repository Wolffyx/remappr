// Connect GitHub bounce: the GitHub App's authorization returns here with
// ?code=…&state=…. A web app opened this as a popup: hand both back to it and
// close. The desktop app opened it in the system browser: hand them over on
// remappr://github/callback, and show the code for pasting where that link
// cannot open (AppImage / tar.gz never register the scheme).
;(function () {
    var params = new URLSearchParams(window.location.search)
    var code = params.get('code')
    var state = params.get('state') || ''
    var title = document.getElementById('title')
    var lead = document.getElementById('lead')

    // The code is single-use and only works with the app's own verifier;
    // keep it out of history either way.
    window.history.replaceState(null, '', window.location.pathname)

    if (!code || !/^[A-Za-z0-9_-]{8,64}$/.test(code)) {
        title.textContent = 'GitHub was not connected'
        lead.textContent =
            params.get('error_description') ||
            'No code came back from GitHub. Close this tab and try again from Remappr.'
        return
    }

    var opener = null
    try {
        opener =
            window.opener && window.opener.location.origin === window.location.origin
                ? window.opener
                : null
    } catch {
        // A cross-origin opener: not ours, so not handed anything.
        opener = null
    }
    if (opener) {
        opener.postMessage({ type: 'remappr:github', code: code, state: state }, window.location.origin)
        title.textContent = 'GitHub connected'
        lead.textContent = 'You can close this tab.'
        window.close()
        return
    }

    var link =
        'remappr://github/callback?code=' +
        encodeURIComponent(code) +
        '&state=' +
        encodeURIComponent(state)
    title.textContent = 'Opening Remappr…'
    lead.textContent = 'Your browser should ask to open Remappr. Allow it to finish connecting GitHub.'
    document.getElementById('code').textContent = code
    document.getElementById('open').setAttribute('href', link)
    document.getElementById('code-box').hidden = false
    document.getElementById('copy').addEventListener('click', function () {
        navigator.clipboard.writeText(code).then(function () {
            document.getElementById('copy').textContent = 'Copied'
        })
    })
    window.location.href = link
})()
