// pattern-check: skip — pure mapper from Supabase error shapes to user text.
//
// supabase-js returns plain objects (PostgrestError, AuthError-like) that are not
// always `Error` instances, so `String(e)` prints "[object Object]".

interface ErrorLike {
    message?: unknown
    code?: unknown
    details?: unknown
}

// Raised by our migrations (`raise exception '<key>'`) or Postgres constraints.
const FRIENDLY: readonly [RegExp, string][] = [
    [/username_reserved/, 'That username is reserved'],
    [/users_username_key/, 'That username is taken'],
    [/users_username_check/, 'That username is not allowed'],
    [/rate_limited/, 'Too many attempts. Try again later.'],
    // Linking sign-in methods (Account → Sign-in methods).
    [
        /identity_already_exists|already linked to another user/i,
        'That login already belongs to another Remappr account. Sign in with it to use that account, or delete that account first (Account → Your data) and link the login here.',
    ],
    [
        /manual_linking_disabled|manual linking is disabled/i,
        'Linking sign-in methods is not turned on for this server.',
    ],
    [
        /single_identity_not_deletable|at least 1 identity after unlinking/i,
        'This is your only way to sign in, so it stays.',
    ],
    [
        /email_conflict_identity_not_deletable|unlink identity due to email conflict/i,
        'This login carries your account email, so it stays.',
    ],
    [
        /email rate limit exceeded|over_email_send_rate_limit/i,
        'Too many sign-in emails were sent just now. Wait a while, or continue with GitHub, Discord or Google.',
    ],
    [
        /For security purposes, you can only request this after/i,
        'Wait a few seconds before asking for another code.',
    ],
]

/** A readable message for anything a cloud call threw or returned. */
export function cloudErrorMessage(e: unknown): string {
    const raw =
        e instanceof Error
            ? e.message
            : typeof e === 'object' && e !== null
              ? [(e as ErrorLike).message, (e as ErrorLike).details]
                    .filter((v): v is string => typeof v === 'string')
                    .join(' ')
              : String(e)
    // An AuthError's code (identity_already_exists, …) names the case even
    // when its message wording changes.
    const code =
        typeof e === 'object' &&
        e !== null &&
        typeof (e as ErrorLike).code === 'string'
            ? (e as ErrorLike).code
            : ''
    const friendly = FRIENDLY.find(([re]) => re.test(`${raw} ${code}`))
    return friendly?.[1] ?? (raw || 'Something went wrong')
}

/** The `{ error }` code an Edge Function replied with, else a readable message. */
export async function functionErrorCode(error: unknown): Promise<string> {
    const response = (error as { context?: Response }).context
    const body = (await response?.json?.().catch(() => null)) as {
        error?: string
    } | null
    return body?.error ?? cloudErrorMessage(error)
}
