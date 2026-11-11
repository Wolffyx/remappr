import { describe, expect, it } from 'vitest'
import {
    draftNotes,
    isVersion,
    latestVersion,
    isPlainTag,
    itemReleases,
    nextVersion,
    tagOf,
    versionOfTag,
} from './release'

describe('release helpers', () => {
    it('reads the newest version, ignoring what is not one', () => {
        expect(latestVersion(['v0.2.0', 'v0.10.1', 'v0.9.9', 'nightly'])).toBe(
            '0.10.1',
        )
        expect(latestVersion(['nightly'])).toBeNull()
    })

    it('offers the document version when it is new, else a patch bump', () => {
        expect(nextVersion(undefined, [])).toBe('0.1.0')
        expect(nextVersion('1.2.0', [])).toBe('1.2.0')
        expect(nextVersion(undefined, ['v1.2.0'])).toBe('1.2.1')
        expect(nextVersion('2.0.0', ['v1.2.0'])).toBe('2.0.0')
        // An old or released document version is not offered again.
        expect(nextVersion('1.2.0', ['v1.2.0'])).toBe('1.2.1')
        expect(nextVersion('not-semver', ['v0.1.0'])).toBe('0.1.1')
    })

    it('makes tags and checks versions', () => {
        expect(tagOf('corne', ' 1.0.0 ')).toBe('corne-v1.0.0')
        expect(isVersion('1.0.0')).toBe(true)
        expect(isVersion('v1.0')).toBe(false)
    })

    it('reads an item’s version from its own tag or a plain one', () => {
        expect(versionOfTag('corne-v1.2.3', 'corne')).toBe('1.2.3')
        expect(versionOfTag('v1.2.3', 'corne')).toBe('1.2.3')
        expect(versionOfTag('other-v1.2.3', 'corne')).toBeNull()
        // A slug that extends another is not that one's.
        expect(versionOfTag('corne-v2-v0.1.0', 'corne')).toBeNull()
        expect(versionOfTag('corne-v2-v0.1.0', 'corne-v2')).toBe('0.1.0')
        expect(versionOfTag('nightly', 'corne')).toBeNull()
        expect(isPlainTag('v1.0.0')).toBe(true)
        expect(isPlainTag('corne-v1.0.0')).toBe(false)
    })

    it('keeps an item’s releases: its own tags and plain ones on its branch', () => {
        const releases = [
            { tag: 'corne-v0.2.0', target: 'x' },
            { tag: 'other-v0.2.0', target: 'mine' },
            { tag: 'v0.1.0', target: 'mine' },
            { tag: 'v1.0.0', target: 'theirs' },
            { tag: 'nightly', target: 'mine' },
        ]
        expect(
            itemReleases(releases, 'corne', (t) => t === 'mine').map(
                (r) => r.tag,
            ),
        ).toEqual(['corne-v0.2.0', 'v0.1.0'])
    })

    it('drafts notes without plumbing commits or repeats', () => {
        expect(
            draftNotes([
                'Start syncing with Remappr',
                'Add a thumb layer',
                'Update Corne',
                'Update Corne',
                'Attach the firmware to GitHub Releases',
            ]),
        ).toBe('- Add a thumb layer\n- Update Corne')
        expect(draftNotes([])).toBe('')
    })
})
