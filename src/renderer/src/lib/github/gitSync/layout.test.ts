import { describe, expect, it } from 'vitest'
import {
    commitMessage,
    commitSubject,
    generatedFiles,
    gitBlobSha,
    handEditedFiles,
    parseManifest,
    slugOf,
    sourcePath,
    withItem,
} from './layout'

describe('git sync layout', () => {
    it('makes file-safe slugs', () => {
        expect(slugOf('Corne  Choc (v2)')).toBe('corne-choc-v2')
        expect(slugOf('Ñandú')).toBe('nandu')
        expect(slugOf('***')).toBe('remappr')
    })

    it('puts the source in the link folder', () => {
        expect(sourcePath({ folder: 'cfg/remappr', slug: 'corne' })).toBe(
            'cfg/remappr/corne.remappr.json',
        )
    })

    it('computes git blob ids', async () => {
        // git hash-object of "hello\n"
        expect(await gitBlobSha('hello\n')).toBe(
            'ce013625030ba8dba906f756967f9e9ca394464a',
        )
    })

    it('generates nothing without a target or for non-keymaps', () => {
        const none = new Set<string>()
        expect(
            generatedFiles(
                { kind: 'remappr.keymap', source: '{}' },
                { target: null },
                none,
            ),
        ).toEqual([])
        expect(
            generatedFiles(
                { kind: 'remappr.device', source: '{}' },
                { target: 'zmk' },
                none,
            ),
        ).toEqual([])
    })

    it('replaces only its own manifest row', () => {
        const prev = parseManifest(
            JSON.stringify({
                generator: 'old',
                items: [
                    {
                        slug: 'b',
                        version: 1,
                        source: 'r/b.remappr.json',
                        target: null,
                        generated: [],
                    },
                    {
                        slug: 'a',
                        version: 1,
                        source: 'r/a.remappr.json',
                        target: null,
                        generated: [],
                    },
                ],
            }),
        )
        const next = withItem(
            prev,
            {
                slug: 'a',
                version: 2,
                source: 'r/a.remappr.json',
                target: 'zmk',
                generated: [],
            },
            'remappr@1',
        )
        expect(next.generator).toBe('remappr@1')
        expect(next.items.map((i) => `${i.slug}${i.version}`)).toEqual([
            'a2',
            'b1',
        ])
    })

    it('reads a damaged manifest as none', () => {
        expect(parseManifest('{nope')).toBeNull()
        expect(parseManifest('{"items": 3}')).toBeNull()
    })

    it('finds generated files edited or deleted on GitHub', () => {
        const manifest = {
            generator: '',
            items: [
                {
                    slug: 'a',
                    version: 1,
                    source: 'r/a.remappr.json',
                    target: 'zmk',
                    generated: [
                        { path: 'config/a.keymap', blob: '1' },
                        { path: 'config/a.conf', blob: '2' },
                        { path: 'config/west.yml', blob: '3' },
                    ],
                },
            ],
        }
        const tree = new Map([
            ['config/a.keymap', '1'],
            ['config/a.conf', 'changed'],
        ])
        expect(handEditedFiles(manifest, 'a', tree)).toEqual([
            'config/a.conf',
            'config/west.yml',
        ])
        expect(handEditedFiles(manifest, 'a', tree, ['config/a.conf'])).toEqual(
            ['config/west.yml'],
        )
        expect(handEditedFiles(manifest, 'other', tree)).toEqual([])
    })

    it('writes the trailer and reads the subject back', () => {
        const m = commitMessage('', 'Corne', 4)
        expect(m).toBe('Update Corne\n\nRemappr-Version: 4')
        expect(commitSubject(m)).toBe('Update Corne')
    })
})
