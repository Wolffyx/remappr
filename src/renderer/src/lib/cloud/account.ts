// Pattern check: no GoF pattern (-) — rejected — two thin calls to the
// account Edge Functions; nothing varies between them.
//
// Account export and deletion (plan P7). Both act on the signed-in caller only;
// the functions take the id from the bearer token.
import { getCloudClient, type CloudClient } from './client'
import { functionErrorCode } from './errors'

const DELETE_ERRORS: Record<string, string> = {
    confirm_mismatch: 'The email does not match this account',
    active_subscription:
        'Cancel your subscription first, then delete the account',
    not_authenticated: 'Sign in again, then try once more',
}

async function requireClient(): Promise<CloudClient> {
    const client = await getCloudClient()
    if (!client) throw new Error('Accounts are not available in this build')
    return client
}

/** Everything the cloud keeps about the caller, as one JSON document. */
export async function exportAccount(): Promise<unknown> {
    const client = await requireClient()
    const { data, error } = await client.functions.invoke('export-account', {
        body: {},
    })
    if (error) throw new Error(await functionErrorCode(error))
    return data
}

/** Delete the caller's account for good; `confirm` is its email. The session
 *  is dropped locally afterwards (the server already ended it). */
export async function deleteAccount(confirm: string): Promise<void> {
    const client = await requireClient()
    const { error } = await client.functions.invoke('delete-account', {
        body: { confirm },
    })
    if (error) {
        const code = await functionErrorCode(error)
        throw new Error(DELETE_ERRORS[code] ?? code)
    }
    await client.auth.signOut({ scope: 'local' })
}
