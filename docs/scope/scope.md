# Scope: Bookified

Bookified turns a reader's own PDFs into spoken conversations: upload a book, pick a voice, and talk to it. It is built for individual readers who want a study companion for books they already own.

**Build approach:** Tracer Bullet (each feature runs end to end through every layer and works, narrow but real). (basis: your `AGENTS.md` stack, a live product with paying users, vertical slices ship real value early)
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less. (basis: a real product with no compliance scope and no test runner yet)

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Accounts and sessions | Existing | existing |
| B | Book upload and parsing | Existing | existing |
| C | Library and search | Existing | existing |
| D | Voice conversation | Existing | existing |
| E | Plan limits and billing | Existing | existing |
| F | Data model | Existing | existing |
| G | Design system and app shell | Existing | existing |
| 1 | Test harness | Foundation | in-progress |
| 2 | Grounded answers from the book | Slice 1 | planned |
| 3 | Edit a book's details | Slice 2 | planned |
| 4 | Delete and restore a book | Slice 2 | planned |
| 5 | Product analytics and error monitoring | Slice 3 | planned |
| 6 | Accessibility pass | Slice 3 | planned |
| 7 | Public pages and SEO metadata | Slice 3 | planned |
| 8 | Legal pages and cookie consent | Slice 3 | planned |

## Already built

Enrolled for context. These predate the workflow, so they are `existing` rather than `done` and no later skill picks them up.

### A. Accounts and sessions · existing
Sign in, sign up, and the middleware gate that protects every page behind a session. code in `app/sign-in/`, `app/sign-up/`, `proxy.ts`

### B. Book upload and parsing · existing
A signed in reader uploads a PDF and an optional cover, the browser parses the pages into 200 word segments, and the files land in blob storage. code in `components/UploadForm.tsx`, `app/api/upload/route.ts`, `lib/utils.ts`

### C. Library and search · existing
The home library lists a reader's own books with title and author search, and shows a bundled sample library to signed out visitors. code in `app/(root)/page.tsx`, `lib/actions/book.actions.ts`

### D. Voice conversation · existing
A live spoken conversation about one book, with a transcript, a status indicator, a timer, and a voice choice. code in `components/VapiControls.tsx`, `components/Transcript.tsx`

### E. Plan limits and billing · existing
Free, standard, and pro plans through Clerk Billing, metering books owned and conversations per month, with a subscriptions screen. code in `lib/subscription-constants.ts`, `lib/subscription.server.ts`, `app/(root)/subscriptions/page.tsx`

### F. Data model · existing
The book, segment, and voice session documents, each scoped to the owning reader. code in `database/`

### G. Design system and app shell · existing
The Tailwind v4 theme, the shadcn primitives, the navbar, the hero, and the loading overlay. code in `app/globals.css`, `components/ui/`

## Foundations

### 1. Test harness · in-progress
The Beta stage closes with `/test`, and no test runner exists in the repo yet, so there is nowhere for the tests of the coming features to live. (basis: foundations before features, and `package.json` has no test script)
**Done when:** a test command runs in the repo, it covers one existing server action as a first real test, and the framework choice is recorded so later features inherit it.
spec [0001](../specs/0001-test-harness/index.md) · code in `test/`, `vitest.config.mts`
- [x] Design it (spec): `/architect test harness`
- [x] Build it: `/develop test harness`
  - [x] One command, one real test green (dependencies, config, database helper, Clerk fake, factories, scripts, the first test) · AC-1, AC-2, AC-3, AC-4, AC-5, AC-8, AC-9
  - [x] The component half proven (the DOM project and the card test) · AC-6
  - [x] Recorded and inherited (preferences file, coverage script, ignored artifacts, flags for `/sync`) · AC-2, AC-7, AC-10
- [x] Verify it: `/check verify test harness`
- [x] Test it: `/test test harness`

## Slice 1: Answers from the book

### 2. Grounded answers from the book · needs a decision
The assistant answers from the reader's own copy instead of general knowledge, and names the page an answer came from, so the conversation is trustworthy. Today the upload path stores segments per page and nothing ever reads them back. (basis: the code scan, `BookSegment` is written in `lib/actions/book.actions.ts` and never queried)
**Done when:** during a live conversation a question about the book is answered from the stored text and the reply names the page it came from; a question the book does not cover is declined honestly instead of invented; the answer still arrives inside a conversation pace that feels spoken.
- [ ] Design it (spec): `/architect grounded answers from the book`

## Slice 2: Managing your books

### 3. Edit a book's details · needs a decision
A reader can correct the title, author, or cover after upload, which they cannot do today, and the stored text stays attached. (basis: the code scan, books are only ever created in `lib/actions/book.actions.ts`)
**Done when:** the title, author, and cover can be changed from the book view and the library reflects it; a link a reader already had to the book keeps working; the segments stay attached to the book.
- [ ] Design it (spec): `/architect edit a book's details`

### 4. Delete and restore a book · needs a decision
A reader can clear a book out of the library without losing it by accident, and the plan slot it used comes back, which matters because books are metered. (basis: `PLAN_LIMITS` counts books per plan in `lib/subscription-constants.ts`)
**Done when:** deleting hides the book and its conversations right away and frees the plan slot; the reader can restore it inside a recovery window; once the window passes the stored file, the cover, and the segments are gone for good.
- [ ] Design it (spec): `/architect delete and restore a book`

## Slice 3: Trust and reach

### 5. Product analytics and error monitoring · needs a decision
See where readers stall and catch assistant and upload failures, because this pass is judged by paid upgrades and today nothing is measured. (basis: a note to track book uploads sits unused in `components/UploadForm.tsx`)
**Done when:** the events that matter are recorded (sign up, book uploaded, conversation started, limit reached, upgrade started) and reportable; assistant and upload failures arrive with enough context to act on; no book text or transcript leaves the app in the payloads.
- [ ] Design it (spec): `/architect product analytics and error monitoring`

### 6. Accessibility pass
Make the library, upload, and conversation screens usable with a keyboard and a screen reader, so the product works for readers who do not use a mouse. (basis: accessibility as a cross cutting concern agreed for this pass)
**Done when:** the three screens can be used with the keyboard alone, focus is always visible, every control has an accessible name, and contrast meets WCAG 2.2 AA.
- [ ] Build it: `/develop accessibility pass`

### 7. Public pages and SEO metadata · needs a decision
The home page is already public and shows sample books, but it tells a search engine and a shared link nothing useful. (basis: `getAllBooks` serves `sampleBooks` to signed out visitors)
**Done when:** the public pages carry real titles, descriptions, and social cards; a sample book can be opened without an account; the public pages are listed in a sitemap.
- [ ] Design it (spec): `/architect public pages and SEO metadata`

### 8. Legal pages and cookie consent · needs a decision
Accounts, payments, and soon analytics mean readers are owed a privacy policy, terms, and a real consent choice. (basis: analytics decides what the policy must disclose, so it follows feature 5)
**Done when:** privacy and terms are reachable from the footer and the sign up screen; a reader can accept or refuse non essential cookies before anything non essential loads.
- [ ] Design it (spec): `/architect legal pages and cookie consent`

## Deferred

Out of scope for this build pass, kept so the plan stays honest.

- **Session history**: revisit past conversations per book · needs a decision (basis: `hasSessionHistory` is declared in `PLAN_LIMITS` and nothing reads it)
- **Conversation recaps**: a short written summary of a finished conversation · needs a decision
- **Sharing**: a read only link to a book or a conversation · needs a decision
- **Text follow along**: highlight the passage while the voice reads it · needs a decision
- **Multi user libraries**: book clubs and educators sharing titles · needs a decision
- **Notifications**: a warning as a reader nears the monthly limit, plus re engagement email · needs a decision
- **Test pipeline**: run the suite automatically on a branch, so a failing test blocks a merge instead of being remembered · from spec 0001 (basis: the harness is worth more once something runs it without being asked)
- **End to end browser tests**: real browser flows for the pages, once a page level feature needs them · from spec 0001 (basis: ruled out of the test harness decision, and the `clerk-testing` skill is already installed for when it is not)

## References

**Project sources**
- `AGENTS.md` plus the nested `lib/`, `database/`, and `components/` context docs, for the stack, conventions, and metering rules.
- The code itself, read during this pass: `app/`, `components/`, `lib/actions/`, `database/`.
- `lib/subscription-constants.ts`, for the plan limits and the unused `hasSessionHistory` flag.
- `package.json`, for the scripts that exist today.

**Practices & standards**
- Vertical slices ship real value early, which is why the grounding thread runs before the rest.
- Foundations before features, which is why the test harness comes before the stage that needs it.
- Decide what is costly to reshape before anything depends on it, which is why slug stability and soft delete get their own decisions.
- WCAG 2.2 AA as the accessibility target.

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | `/architect` at spec capture | `Design it` ticked; spec linked; `Build it: /develop <feature>` + 2 to 5 milestones; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA) |
| `in-progress` (building) | `/develop` | milestone sub-boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | you, when you decide it is; `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Beta` → after `/test`) is the suggested point to call it done |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`. The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature's rigor above or below the project default; no tag inherits the default.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Beta** = `/check verify` then `/test`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
