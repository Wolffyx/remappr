import { describe, expect, it } from 'vitest'
import type { UserIdentity } from '@supabase/supabase-js'
import {
    githubLinkVerdict,
    githubLoginOf,
    identitiesOf,
    identityLabel,
    isNewProviderAccount,
    providerLabel,
} from './identities'

const identity = (
    provider: string,
    data: Record<string, unknown>,
    id = `${provider}-1`,
): UserIdentity => ({
    id,
    identity_id: id,
    user_id: 'u1',
    provider,
    identity_data: data,
})

describe('identityLabel', () => {
    it('shows a GitHub login with an @', () => {
        expect(
            identityLabel(
                identity('github', { user_name: 'octo', email: 'o@x.io' }),
            ),
        ).toBe('@octo')
    })

    it('falls back to the email, then a name', () => {
        expect(identityLabel(identity('email', { email: 'a@b.c' }))).toBe(
            'a@b.c',
        )
        expect(identityLabel(identity('discord', { full_name: 'Ada' }))).toBe(
            'Ada',
        )
        expect(identityLabel(identity('google', {}))).toBe('')
    })
})

describe('identitiesOf / githubLoginOf', () => {
    it('lists every identity and finds the GitHub login', () => {
        const list = identitiesOf({
            identities: [
                identity('email', { email: 'a@b.c' }),
                identity('github', { user_name: 'octo' }),
            ],
        })
        expect(list.map((i) => i.provider)).toEqual(['email', 'github'])
        expect(list[1].id).toBe('github-1')
        expect(githubLoginOf(list)).toBe('octo')
    })

    it('is empty without identities', () => {
        expect(identitiesOf({})).toEqual([])
        expect(githubLoginOf([])).toBeNull()
    })
})

describe('isNewProviderAccount', () => {
    const now = Date.parse('2026-11-06T12:00:00Z')

    it('is a provider account made a moment ago', () => {
        expect(
            isNewProviderAccount(
                {
                    created_at: '2026-11-06T11:59:30Z',
                    identities: [identity('github', {})],
                },
                now,
            ),
        ).toBe(true)
    })

    it('is not an old account, an email account or a linked one', () => {
        expect(
            isNewProviderAccount(
                {
                    created_at: '2026-11-01T00:00:00Z',
                    identities: [identity('github', {})],
                },
                now,
            ),
        ).toBe(false)
        expect(
            isNewProviderAccount(
                {
                    created_at: '2026-11-06T11:59:30Z',
                    identities: [identity('email', {})],
                },
                now,
            ),
        ).toBe(false)
        expect(
            isNewProviderAccount(
                {
                    created_at: '2026-11-06T11:59:30Z',
                    identities: [identity('email', {}), identity('github', {})],
                },
                now,
            ),
        ).toBe(false)
    })
})

describe('githubLinkVerdict', () => {
    it('says nothing without a fresh connect or an account', () => {
        expect(githubLinkVerdict(null, true, null)).toBe('none')
        expect(githubLinkVerdict('octo', false, null)).toBe('none')
    })

    it('asks when the account has no GitHub sign-in', () => {
        expect(githubLinkVerdict('octo', true, null)).toBe('ask')
    })

    it('matches logins without case', () => {
        expect(githubLinkVerdict('Octo', true, 'octo')).toBe('same')
        expect(githubLinkVerdict('octo', true, 'other')).toBe('other')
    })
})

describe('providerLabel', () => {
    it('names known providers', () => {
        expect(providerLabel('email')).toBe('Email')
        expect(providerLabel('github')).toBe('GitHub')
        expect(providerLabel('gitlab')).toBe('gitlab')
    })
})
