// pattern-check: skip — one side-effect import, evaluated before any schema.
//
// The CSP forbids eval. Tell zod up front instead of letting it probe with
// `new Function` (which the policy reports as a violation). main.tsx imports
// this first, so it runs before any module that parses at import time.
import { config } from 'zod'

config({ jitless: true })
