// pattern-check: skip — unit tests for the account export/delete calls
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
const signOut = vi.fn()
vi.mock('./client', () => ({
    getCloudClient: async () => ({
        functions: { invoke },
        auth: { signOut },
    }),
}))

import { deleteAccount, exportAccount } from './account'

const replied = (status: number, body: unknown): { error: unknown } => ({
    error: { context: new Response(JSON.stringify(body), { status }) },
})

describe('account calls', () => {
    beforeEach(() => {
        invoke.mockReset()
        signOut.mockReset()
    })

    it('returns the export document', async () => {
        invoke.mockResolvedValue({ data: { format: 'remappr.account-export' } })
        expect(await exportAccount()).toEqual({
            format: 'remappr.account-export',
        })
        expect(invoke).toHaveBeenCalledWith('export-account', { body: {} })
    })

    it('deletes, then drops the local session', async () => {
        invoke.mockResolvedValue({ data: { deleted: true } })
        await deleteAccount('me@test.local')
        expect(invoke).toHaveBeenCalledWith('delete-account', {
            body: { confirm: 'me@test.local' },
        })
        expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    })

    it('says why a delete was refused and keeps the session', async () => {
        invoke.mockResolvedValue(replied(409, { error: 'active_subscription' }))
        await expect(deleteAccount('me@test.local')).rejects.toThrow(
            /Cancel your subscription/,
        )
        expect(signOut).not.toHaveBeenCalled()
    })
})
