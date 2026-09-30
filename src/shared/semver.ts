// pattern-check: skip — two pure helpers shared by main and renderer, no abstraction
//
// Release versions are plain `X.Y.Z` (an optional leading `v` and any
// pre-release suffix are ignored).

export function parseVersion(v: string): [number, number, number] | null {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.replace(/^v/, ''))
    if (!m) return null
    return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Negative when `a` is older than `b`, positive when newer, 0 when equal.
 *  null when either side isn't a version. */
export function compareVersions(a: string, b: string): number | null {
    const x = parseVersion(a)
    const y = parseVersion(b)
    if (!x || !y) return null
    for (let i = 0; i < 3; i++) {
        if (x[i] !== y[i]) return x[i] - y[i]
    }
    return 0
}
