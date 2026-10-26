// Desktop sign-in bounce: OAuth returns here with ?code=…; hand it to the app
// over remappr://auth/callback, and show it for pasting where that link can't
// open (AppImage / tar.gz never register the scheme).
;(function () {
    var params = new URLSearchParams(window.location.search)
    var code = params.get('code')
    var title = document.getElementById('title')
    var lead = document.getElementById('lead')

    if (!code || !/^[A-Za-z0-9-]{16,128}$/.test(code)) {
        title.textContent = 'Sign-in did not finish'
        lead.textContent =
            params.get('error_description') ||
            'No sign-in code came back. Close this tab and try again from Remappr.'
        return
    }

    // The code is single-use and only works with this app's own verifier;
    // keep it out of history.
    window.history.replaceState(null, '', window.location.pathname)

    var link = 'remappr://auth/callback?code=' + encodeURIComponent(code)
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
