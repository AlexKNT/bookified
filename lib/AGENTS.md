# lib

## Overview

Shared application logic: server actions, plan metering, constants, and the browser PDF parser. Everything that writes to the database sits in `lib/actions/`, and every plan limit is enforced there rather than only in the UI. Server only files use the `.server.ts` suffix.

## Key files

| File | Owns |
|---|---|
| `actions/book.actions.ts` | Create, look up, and search books, plus the sample library for signed out visitors |
| `actions/session.actions.ts` | Conversation metering: usage, limit check, session start and end |
| `subscription-constants.ts` | `PLANS`, `PLAN_LIMITS`, and the billing period start |
| `subscription.server.ts` | `getUserPlan` and `getPlanLimits`, read from Clerk Billing |
| `constants.ts` | File size caps, accepted types, voice list, Vapi settings, brand colors |
| `zod.ts` | The upload form schema, which is the source of the form types |
| `utils.ts` | `cn` and `parsePDFFile` |

## Conventions

- Files in `lib/actions/` start with `"use server"` and export async functions only.
- An action returns a result object such as `{ success: true, data }` or `{ success: false, error }`. It logs with `console.error` and returns a short user facing message instead of throwing at the client.
- Read limits from `PLAN_LIMITS[plan]`. Never hardcode a book count, a session count, or a session length.
- Get the current plan through `getUserPlan()` or `getPlanLimits()`. Never read a plan from the client.
- Derive form types with `z.infer` from `lib/zod.ts`. Change validation in one place, not in the form.
- Group a new shared helper into the file that already owns the topic. Keep this folder flat, one file per concern.

## Gotchas

- `parsePDFFile` runs in the browser only. It imports `pdfjs-dist` dynamically and points the worker at `/pdf.worker.min.mjs`, so that file has to stay in `public/`. Never import it from server code.
- Signed out visitors get `sampleBooks` from `constants.ts`. Their cover URLs are allow listed in `next.config.ts` for `next/image`, so a new external cover host has to be added there too.
- A month of usage is counted from `billingPeriodStart`, which is stamped on each session row at creation. Counting sessions by date instead would drift from the stored value.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
