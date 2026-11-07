import { describe, expect, it } from 'vitest'
import {
    draftNotes,
    isVersion,
    latestVersion,
    nextVersion,
    tagOf,
} from './release'

describe('release helpers', () => {
    it('reads the newest version tag, ignoring others', () => {
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
        expect(tagOf(' 1.0.0 ')).toBe('v1.0.0')
        expect(isVersion('1.0.0')).toBe(true)
        expect(isVersion('v1.0')).toBe(false)
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
