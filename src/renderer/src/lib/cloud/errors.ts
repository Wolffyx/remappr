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
    const friendly = FRIENDLY.find(([re]) => re.test(raw))
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
