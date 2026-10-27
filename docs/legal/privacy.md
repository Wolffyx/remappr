---
title: Privacy policy
---

# Privacy policy

::: warning Draft
This policy is a draft and not yet in force. Text in `[BRACKETS]` is
still to be filled in.
:::

_Effective `[EFFECTIVE_DATE]`_

Remappr is a keyboard and device manager. It works fully **without an
account**. Then nothing about you or your devices leaves your computer. This
policy is about what happens when you choose to sign in.

**Who we are.** Remappr is run by `[OPERATOR]`, `[OPERATOR_ADDRESS]`
("Remappr", "we"). For anything about your data, write to
`[CONTACT_EMAIL]`.

## Without an account

- Keymaps, boards, layouts, settings and your local library are stored only
  in your browser or in the desktop app's data folder.
- Talking to your keyboard (USB, Bluetooth, serial) happens on your computer.
  Nothing about your device is sent to us.
- There are **no analytics, no telemetry, no advertising and no tracking
  cookies**, signed in or not.
- The app loads its news and release notes from GitHub (`api.github.com`,
  `raw.githubusercontent.com`), so GitHub sees your IP address when it does.
  The web app itself is served by `[WEB_HOST]`, which sees your IP address
  as any web host does.

## With an account

What we keep, and why:

| Data                                                                                                                                          | Why                                    | Legal basis (GDPR)         |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------- |
| Email address                                                                                                                                 | signing in, account messages           | contract                   |
| Name and avatar from GitHub, Discord or Google, if you sign in with one                                                                       | your profile                           | contract                   |
| Username, display name, bio                                                                                                                   | your public profile                    | contract                   |
| Your cloud library: boards, configs, collections, backups, and their versions                                                                 | sync between your machines             | contract                   |
| Items you publish, your stars, comments and reports                                                                                           | the community features                 | contract                   |
| Builder devices: a hash of each device's key, a hash of the machine (desktop app), the platform and a short label (your browser's user-agent) | enforcing the per-plan device limit    | contract                   |
| Purchases: plan, status, amount, dates, Stripe reference ids                                                                                  | providing what you bought, tax records | contract, legal obligation |
| Rate-limit counters and an audit log of builder downloads and moderation                                                                      | preventing abuse and piracy            | legitimate interest        |

Keyboard serial numbers in backups are stored only as a hash.

We never see or store your card or bank details. Payments are handled entirely
by Stripe on its own pages; Stripe keeps your billing name, address and tax id.

Your sign-in session is kept in your browser's local storage (or the desktop
app's storage). It is needed to keep you signed in, and is not used for
anything else.

## What others can see

Everything is **private** unless you change it. Items you set to **unlisted**
can be opened by anyone with the link. Items you **publish** are public,
together with your username, display name, avatar and bio, under the license
you choose. Comments on public items are public.

## Who processes it for us

| Service                 | What for                                                    | Where               |
| ----------------------- | ----------------------------------------------------------- | ------------------- |
| Supabase                | database, sign-in, file storage, server functions           | `[SUPABASE_REGION]` |
| Stripe                  | payments and invoices                                       | US / EU             |
| `[SMTP_PROVIDER]`       | sign-in emails                                              | `[SMTP_REGION]`     |
| Cloudflare              | the docs and staging sites; encrypted database backups (R2) | global              |
| GitHub, Discord, Google | only if you sign in with them                               | US                  |

Where data leaves the EEA, the transfer relies on the provider's Standard
Contractual Clauses or the EU–US Data Privacy Framework.

## How long we keep it

- **Your account and library**: until you delete them.
- **Items you delete**: removed from sync at once and erased after 30 days.
- **Rate-limit counters**: 35 days.
- **Audit log**: 1 year; builder download records 2 years.
- **Purchases**: as long as tax law requires, without a link to you once your
  account is deleted.
- **Backups**: daily backups for 7 days and weekly encrypted backups for 90
  days. Deleted data disappears from them as they expire.

## Your rights

You can see, correct, download and delete your data yourself, in **Settings →
Account**:

- **Download my data** gives you everything above in one JSON file.
- **Delete account** erases your account, profile, library, published items,
  stars, reports, device photos and builder devices. Your comments stay in
  their threads as "[deleted]", without their text.

You can also object to processing, ask us to restrict it, or ask any question,
at `[CONTACT_EMAIL]`. We answer within one month. You may complain to your data
protection authority (`[SUPERVISORY_AUTHORITY]`).

## Children

Accounts are for people aged 16 or older.

## Changes

If this policy changes in a way that matters, we say so in the app before it
takes effect. The date at the top shows the current version.
