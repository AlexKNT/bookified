<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Bookified

## Stack

- **Language / Runtime**: TypeScript, Node 20+ (Next.js App Router)
- **Framework**: Next.js 16.3.5, React 19
- **Key dependencies**: Clerk (`@clerk/nextjs` and Clerk Billing), Mongoose 9 on MongoDB, Vercel Blob, Vapi (`@vapi-ai/web`) with ElevenLabs voices, pdfjs-dist, shadcn/ui on Tailwind v4
- **Package manager**: npm

## Build approach

<TBD, set by /scope>

## Commands

```bash
npm install     # install
npm run dev     # dev server on http://localhost:3000
npm run build   # build
npm run lint    # lint
```

No test runner is configured yet. Specs live in `docs/specs/` as `docs/specs/NNNN-title.md`; none written yet.

## Environment

`.env.local` is gitignored and needs `MONGODB_URI`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, and `NEXT_PUBLIC_ASSISTANT_ID`.

## Rules

- Import through the `@/*` alias, which maps to the repo root: `@/lib/...`, `@/components/...`, `@/types`.
- Shared types live in `types.d.ts`. Do not redeclare a shape inside a component.
- Server actions start with `"use server"` and return a result object, such as `{ success, data }` or `{ success, error }`. They do not throw at the client.
- Every database call is scoped by the Clerk `clerkId`, and every action that touches the database calls `connectToDatabase()` first.
- Plan limits come from `PLAN_LIMITS` in `lib/subscription-constants.ts`. Never hardcode a limit, never trust a plan sent from the client.
- Pages that need a signed in user check `auth()` on the server and `redirect("/sign-in")`. `proxy.ts` runs `clerkMiddleware()` as the first gate.
- Feedback to the user goes through `sonner` toasts, with `LoadingOverlay` while work is in flight.

## Agent skills

- [clerk-setup](.agents/skills/clerk-setup/): `clerk/skills`, adding Clerk to a project and wiring the keys
- [clerk-backend-api](.agents/skills/clerk-backend-api/): `clerk/skills`, browsing and calling Clerk Backend API endpoints
- [clerk-cli](.agents/skills/clerk-cli/): `clerk/skills`, the `clerk` command line tool for users, sessions, and instance config
- [clerk-nextjs-patterns](.agents/skills/clerk-nextjs-patterns/): `clerk/skills`, Next.js App Router patterns such as middleware and server actions
- [clerk-custom-ui](.agents/skills/clerk-custom-ui/): `clerk/skills`, sign in and sign up appearance, themes, and hooks
- [clerk-orgs](.agents/skills/clerk-orgs/): `clerk/skills`, Organizations, roles, and permissions
- [clerk-webhooks](.agents/skills/clerk-webhooks/): `clerk/skills`, webhook verification and event handling
- [clerk-testing](.agents/skills/clerk-testing/): `clerk/skills`, end to end tests for auth flows

## Context files

- [lib/AGENTS.md](lib/AGENTS.md): server actions, plan metering, constants, and the browser PDF parser
- [database/AGENTS.md](database/AGENTS.md): the Mongoose connection, the models, and how queries are scoped
- [components/AGENTS.md](components/AGENTS.md): UI pieces, the upload form, and the voice conversation controls

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
