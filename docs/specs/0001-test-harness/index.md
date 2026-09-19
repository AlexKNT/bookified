# 0001. Adopt Vitest as the test harness

**Date**: 2026-09-19
**Status**: Proposed

## Summary

Bookified has no way to run a test, and the Beta stage closes every feature with `/test`, so there is nothing yet for those tests to run on. This decision stands up the harness once: Vitest for both plain server code and React components, a throwaway MongoDB started by the test run so no test can reach real data, and a small shared helper that fakes a signed in Clerk session. The first real test lands now on the conversation limit rule, and every later feature inherits the same command, the same conventions, and the same recorded preference file instead of choosing tools again.

## Requirements

**User stories**:
- As the developer on this project, I want one command that runs the whole suite, so that I can prove a change before merging it.
- As the developer picking up a later feature, I want the harness already built and the framework already recorded, so that I spend my time writing tests rather than choosing tools.
- As the person who owns the data, I want tests that physically cannot reach my real database or my real Clerk account, so that a mistake in a test cannot damage anything.

**Acceptance criteria** (the contract, each one checkable on its own):

- **AC-1**: `npm test` runs every test file once, exits with code 0 when all tests pass, and exits with a failure code when any test fails. It never hangs waiting for file changes.
- **AC-2**: `npm run test:watch` runs the suite in watch mode for local work, and `npm run test:coverage` writes a coverage report without failing on a threshold.
- **AC-3**: every test runs against a MongoDB started inside the test run, one server per worker process with a fresh database per test file, and collections are emptied between tests.
- **AC-4**: the suite refuses to run against anything else. The shared setup replaces the database address before any application code loads, then compares the live connection's host, port, and database name against the throwaway server and throws when they differ, so the address in `.env.local` can never be read or written by a test. This check is defence in depth rather than the only guard: it fires once a harness is running, so a setup that never loaded surfaces instead as the missing address error that `database/mongoose.ts` throws.
- **AC-5**: the first real test file `lib/actions/session.actions.test.ts` covers `checkSessionLimit`: an allowance case below the limit, the case at the limit that is refused with the plan's own message, the signed out case, and a session stamped in an earlier billing period that is not counted. The limit numbers come from `PLAN_LIMITS`, never from a literal.
- **AC-6**: `components/BookCard.test.tsx` renders the component in a DOM environment and asserts what a reader sees, from the same `npm test` command, proving the component half of the harness works rather than merely being installed.
- **AC-7**: `test-preferences.json` sits at the project root carrying all seven fields the `/test` skill reads: `tool` as Vitest, `gate` as null, `additionalTools` holding the Testing Library packages, `e2eTool` as none, `testDir` as beside the source, `filePattern` as `*.test.ts`, and `packageManager` as npm, so `/test` inherits the choice instead of asking for it again.
- **AC-8**: no test reads `.env.local` or any secret, and once the MongoDB binary is cached on the machine the whole suite passes with no network access.
- **AC-9**: test files are type checked with the rest of the project, so a test that stops compiling fails the build check.
- **AC-10**: the shared conventions live in one helper module (the database lifecycle, the Clerk session fake, and the document factories), and the standing rules for later test files are written down where the next person will find them.

## Decision

**Chosen option**: Option 1, Vitest with a throwaway MongoDB behind a shared helper.

Run the suite with **Vitest**, split into two projects so `.test.ts` files run in Node and `.test.tsx` files run in a DOM, against a **MongoDB started inside the test run** through `mongodb-memory-server`. Fake the Clerk session with one top level `vi.mock("@clerk/nextjs/server")` line in each test file, returning the shared fake, and record the choice in all seven fields of `test-preferences.json` so `/test` picks it up without asking.

**Implementation skills**: `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `clerk-testing` (`clerk/skills`, `.agents/skills/clerk-testing/`)

## Feature design

**Data model sketch**:

This feature creates no application documents. The "data model" here is the set of pieces every test starts from, all of it owned by the shared helper:

| Piece | Creates | Owned by | Notes |
|---|---|---|---|
| Throwaway database | A database per test file | `test/db.ts` | One `mongod` per worker process, cached on the worker global; the database name is unique per test file; the helper connects before the file's tests run, empties the database before each test, and disconnects when the file ends |
| Session fake | The Clerk answer to `auth()` | `test/clerk.ts` | Takes a reader id and a plan, then answers `auth()` and its `has()` plan check, or answers as signed out |
| Reader ids | A first and a second Clerk user id | `test/clerk.ts` | The second reader exists only to prove one reader cannot reach another's documents |
| `makeBook()` | A `Book` document | `test/factories.ts` | Fields a real upload would set: title, author, slug, file and cover metadata, `clerkId` |
| `makeSession()` | A `VoiceSession` document | `test/factories.ts` | Takes `clerkId` and `billingPeriodStart`, defaulting to the value `getCurrentBillingPeriodStart()` returns |
| Book segments | `BookSegment` documents | not now | Feature 2 reads stored text back, so the factory arrives with it |

**State transitions**: not applicable. Nothing here has a lifecycle; the harness either runs or it fails.

**API surface**:

The surface of this feature is its commands and its helper, not endpoints:

| Surface | Form | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `npm test` | `vitest run` in `package.json` | optional file path or name pattern | exit code 0 or a failure code; a per file report | none | a failing test exits with a failure code; an empty run fails rather than passing quietly |
| `npm run test:watch` | `vitest` | optional file filter | a live re run on file change | none | none |
| `npm run test:coverage` | `vitest run --coverage` | none | a report under `coverage/` | none | none; no threshold can fail it |
| `signInAs(readerId, { plan })` | exported helper | a reader id and a plan, or nothing for the signed out shape | makes `auth()` and its `has()` plan check answer for that reader and plan | none | a test that forgets to fake Clerk fails loudly, since the real module throws outside a request |
| `makeBook()`, `makeSession()` | exported helpers | field overrides | a saved document | none | a validation failure surfaces as a real Mongoose error |
| `vi.mock("@clerk/nextjs/server")` | one top level line in each test file | none | replaces the real server module with the shared fake | none | the line must sit at the top level of the file, because the runner hoists it and a helper module cannot hoist on the file's behalf |

**Value sourcing** (every value the acceptance criteria need, and where it comes from):

| Value needed | Source |
|---|---|
| The signed in reader's id | Input to `signInAs()`, held by the Clerk fake |
| The plan a reader is on | Derived: the fake's `has()` answer, read by the real `getUserPlan()` in `lib/subscription.server.ts` |
| The session limit for that plan | `PLAN_LIMITS[plan]` in `lib/subscription-constants.ts`, read by both the action and the test |
| The session count in the period | Derived: documents `makeSession()` creates, counted by the action's own query |
| The billing period a session belongs to | `getCurrentBillingPeriodStart()` in `lib/subscription-constants.ts`, passed into `makeSession()` |
| The database address a test runs against | Set by `test/db.ts` from the throwaway server's own URI, before app code loads |
| The proof that the address is the right one | Derived: the live connection's host, port, and database name, compared to the throwaway server's. The environment is never re-read, because `database/mongoose.ts` reads it once at module scope |
| Who connects and who empties | `test/db.ts`, before the file's tests run and before each test, since `bufferCommands` is false and a query issued before the connection resolves fails |
| The file location and naming the runner expects | `test-preferences.json` at the project root, all seven fields |
| The image element the card test sees | The plain image the DOM setup substitutes for `next/image` |
| The limit message shown at the ceiling | Composed inside `checkSessionLimit` from `PLAN_LIMITS`, asserted against the same constants |

**Key invariants**:
- A test process never holds the address from `.env.local`: the setup replaces it before any application module loads, then compares the live connection's host, port, and database name to the throwaway server's and throws when they differ. The environment is not read again, because `database/mongoose.ts` captured it once at module scope.
- The helper owns the connection, not the test files: it connects before the file's tests run, because `bufferCommands` is false and a query issued before the connection resolves fails rather than waits. It empties the file's database before each test and disconnects when the file ends, so a worker does not accumulate open connections.
- One database per test file, emptied between tests, so test order can never matter.
- `global.mongooseCache` is cleared per test file, because `database/mongoose.ts` memoises the connection on purpose for hot reload, and a stale cached connection would point at the previous file's database.
- Clerk is faked by one top level `vi.mock` line in each test file, because the runner hoists that call and a helper cannot hoist on the file's behalf. The helper holds the state the line returns.
- `lib/subscription.server.ts` stays real: the fake supplies both `auth()` and its `has()` plan check, so the plan lookup path is exercised rather than stubbed.
- The DOM project substitutes a plain image for `next/image`, which cannot be served inside a DOM without a running Next server.
- Limits are read from `PLAN_LIMITS`, so a plan change never breaks an unrelated test.
- A database backed test proves that a second reader cannot reach the first reader's documents.
- No test reads a secret and no test makes a network call, apart from the one time MongoDB binary download on a machine that has never run the suite.

**Security model**:
- Tests hold no credentials. Clerk is faked at the module boundary, so no Clerk key is needed and no Clerk API call is made.
- The throwaway MongoDB binds to a local address and is destroyed when the run ends. It cannot be pointed at the cluster in `.env.local`, and the guard turns that from a convention into a failure.
- Fixtures are invented data. No production document, book text, or transcript is ever copied into a test.
- The suite is safe to run on a laptop with no environment file present at all. This is deliberate, and it is what makes the suite usable on a fresh checkout.

**Configuration required**:
- No new environment variables. Tests deliberately read none, which is the point of the override in `test/db.ts`.
- `mongodb-memory-server` is pinned to MongoDB 8.2 in the helper's own configuration rather than through the environment, and it accepts `MONGOMS_*` overrides from the environment if a machine ever needs them, for example to move the binary cache.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: `npm test` runs once, both projects execute, and every test passes with exit code 0, verifies **AC-1**, **AC-3**, **AC-5**, **AC-6**.
- Failure case: a deliberately failing test exits with a failure code rather than passing or hanging, and a run pointed at any other database stops at the connection check instead of reading or writing it, verifies **AC-1**, **AC-4**.
- Auth and permission: the signed out case gets the sign in message instead of a limit answer, and a second reader's documents never appear in the first reader's count, verifies **AC-5**.
- Inheritance: a fresh reader of the project can tell what runs the tests from `test-preferences.json` alone, verifies **AC-7**, **AC-10**.

## Build plan

Order follows the project's build approach, Tracer Bullet: the first milestone drives one thin thread all the way from the command to a real assertion against a real database, and only then does the second milestone thicken the surface. Nothing in the first milestone is a stub that a later task replaces.

**Milestone A: one command, one real test, green**

1. Install the dev dependencies: `vitest`, `vite`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@vitest/coverage-v8`, and `mongodb-memory-server`. Move `@types/node` from 20 to 22 in the same step, so the types match the 22.12 floor the runner needs rather than the 24 this machine happens to run, satisfies **AC-1**, **AC-9**.
2. Create `vitest.config.mts` with two projects: `.test.ts` in Node, `.test.tsx` in jsdom, the tsconfig paths plugin so `@/*` resolves without a second copy of the path map, a raised hook timeout for the first database start, no silent pass when no test is found, and the DOM project pointed at the setup file from task 5, satisfies **AC-1**, **AC-6**, **AC-9**.
3. Create `test/db.ts`: one throwaway server per worker process, a fresh database name per test file, a connection made before the file's tests run with the database emptied before each test and disconnected when the file ends, `global.mongooseCache` cleared per file, and the guard that compares the live connection's host, port, and database name to the throwaway server and throws when they differ, satisfies **AC-3**, **AC-4**, **AC-8**.
4. Create `test/clerk.ts`: the session fake behind `signInAs(readerId, { plan })`, supplying `auth()` plus its `has()` plan check, with the signed out answer as the default, and holding the state that each test file's own top level `vi.mock` line returns, satisfies **AC-5**, **AC-10**.
5. Create `test/factories.ts` with `makeBook()` and `makeSession()` and the second reader id, plus `test/setup.ts` importing `@testing-library/jest-dom/vitest` so the matchers and their types both register, and substituting a plain image for `next/image`, satisfies **AC-3**, **AC-5**, **AC-6**, **AC-9**, **AC-10**.
6. Add `test`, `test:watch`, and `test:coverage` to `package.json`, satisfies **AC-1**, **AC-2**.
7. Write `lib/actions/session.actions.test.ts`: allowance below the limit, the ceiling refused with the plan's own message, the signed out case, and an earlier period session that is not counted, satisfies **AC-5**.

**Milestone B: the component half proven**

8. Write `components/BookCard.test.tsx`, rendering the card and asserting the title, the author, and the destination a reader follows, satisfies **AC-6**.

**Milestone C: recorded and inherited**

9. Write `test-preferences.json` with all seven fields the `/test` skill reads: `tool`, `gate` as null, `additionalTools`, `e2eTool` as none, `testDir` as beside the source, `filePattern` as `*.test.ts`, and `packageManager`, satisfies **AC-7**.
10. Wire the v8 coverage provider for `test:coverage`, reporting only, with no threshold, satisfies **AC-2**.
11. Add `/.vitest/` to `.gitignore` for the runner's own artifacts (`/coverage` is already ignored), satisfies **AC-1**.
12. Flag for `/sync` (which owns context files, not this skill): the three new scripts, the raised Node floor, the standing rules, the `vitest` skill bullet, and the declined candidates, satisfies **AC-10**.

## Consequences

**Positive**:
- The Beta loop becomes real. `/test` writes tests instead of asking for a framework, and `/check verify` has a suite to read alongside the running app.
- Tests run real Mongo queries against a real server, so the `clerkId` scoping rule and the compound index are exercised rather than assumed. Mocking the models would have skipped exactly the code most likely to break.
- A fresh clone can run the suite with no `.env.local` and no Clerk keys, which means nobody is tempted to paste a real key into a test file.
- The guard turns "do not point tests at production" from a convention somebody must remember into a failure that happens before the first test runs.

**Negative and tradeoffs**:
- Node 22.12 or newer is now a real requirement for running the suite, while `AGENTS.md` and `@types/node` still say 20. The installed Node is 24, so nothing breaks today, and the recorded floor has to catch up.
- The first run on a new machine needs the network once to fetch the MongoDB binary, and a cold start costs a second or so on top of the test time.
- Faking `@clerk/nextjs/server` is our own invention. Clerk documents browser testing helpers only, so this is the piece most likely to need attention if Clerk changes its server module.
- A helper layer sits between a new test and the code under test, so a reader has to learn three small files before writing the first test.
- The guard compares the live connection, so it catches a wrong address in a harness that starts, not a harness that never loaded. If the setup file fails to run, the symptom is the missing address error from `database/mongoose.ts` instead. That is an honest limit of the check rather than a hole in it.

**Neutral**:
- `@types/node` moves from 20 to 22 as part of this build, so this decision changes an existing dependency rather than only adding new ones.
- Vitest 5 expresses the two environments as projects, which replaced the older workspace setting. Anyone reading older Vitest material will see a different config shape.
- Coverage is reported but never enforced, so it informs review rather than gating a merge.
- Test files live beside the source and stay inside the project type check, which makes the build slightly slower and the suite much harder to let rot.
- Book segments have no factory yet. Feature 2 will want one, and the helper is where it goes.

## Follow-up

- [ ] `/sync` should add `test`, `test:watch`, and `test:coverage` to the Commands block in root `AGENTS.md`, and change the Node line from 20+ to 22.12+, since that is now the floor for running the suite.
- [ ] `/sync` should add the four standing rules to root `AGENTS.md` (tests fake Clerk, database backed tests go through `test/db.ts`, action tests assert the `clerkId` scoping, limits come from `PLAN_LIMITS`), because they apply to every test file anywhere in the project.
- [ ] `vitest` conventions are not yet in root `AGENTS.md`. The skill was installed from `antfu/skills` at `.agents/skills/vitest/` during this decision and applies to every test file, so its bullet belongs in the `## Agent skills` section at root level.
- [ ] Add the `MCP servers:` line to root `AGENTS.md` when the official MongoDB server is connected in your own MCP settings. It was chosen here but connecting is a user settings step, so nothing was installed for it.
- [ ] Record the decline so nothing offers these again: the `react-testing-library`, `nextjs-vitest`, `vite`, and MongoDB agent skills, and the `next-devtools-mcp` and community `vitest-mcp` servers.
- [ ] This build moves `@types/node` to 22 and records a 22.12 floor, while this machine runs Node 24. Align all three when you next touch the toolchain, so the pinned types, the documented floor, and the real runtime agree.
- [ ] End to end browser testing stays out of scope. When a page level feature needs it, Playwright is the likely pick and the installed `clerk-testing` skill already covers the Clerk side of that decision.
- [ ] The throwaway server is pinned to MongoDB 8.2. Move the pin when the deployed database moves, so the suite keeps testing the engine you actually run.
- [ ] No coverage threshold is enforced. If the suite grows past a few dozen files, deciding a number is a fresh decision worth its own spec.

## Rationale

Reasoning, the options weighed, and the sources this rests on: see [rationale.md](rationale.md).
