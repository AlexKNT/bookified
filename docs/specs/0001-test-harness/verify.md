# Verify: test harness · spec 0001 · updated 2026-09-19

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands

- [x] `npm test` → 7 tests in 2 files pass, exit code 0, and the run ends on its own without waiting for file changes → AC-1, AC-3, AC-5, AC-6
- [x] Break one assertion in `lib/actions/session.actions.test.ts`, run `npm test`, then undo it → a failure code and a report naming the failing test → AC-1
- [x] Run `npm test` twice in a row → the second run is fast, because the MongoDB binary is cached → AC-8
- [x] `npm run test:coverage` → a report under `coverage/`, exit code 0, nothing fails on a threshold → AC-2
- [ ] `npm run test:watch` in a real terminal (not a captured one) → the suite runs and stays watching, and reruns when a test file is saved → AC-2
- [x] `npx tsc --noEmit` → exit 0, with the test files inside the program → AC-9
- [x] `npm run build` → passes, so a test that stops compiling fails the build check → AC-9
- [x] `$env:MONGODB_URI="mongodb://127.0.0.1:1/not_the_throwaway"` then `npm test` → still 7 pass, so the setup replaced the address before any application code loaded → AC-4
- [x] Log `process.env.MONGODB_URI` from inside a test → it reads `mongodb://127.0.0.1:<port>/bookified_test_<random>`, never the cluster in `.env.local` → AC-4, AC-8
- [ ] Point `test/db.ts` at a different database name (change `databaseName`), run `npm test` → the guard throws instead of letting a test reach a real database → AC-4

## UI / manual

- [x] Rename `.env.local` aside, run `npm test`, then put it back → still 7 pass, so no test reads the environment file → AC-8
- [x] Grep the test files for `process.env` → only `test/db.ts` writes `MONGODB_URI`; nothing reads a secret → AC-8
- [x] Read `test-preferences.json` → all seven fields, `tool` as `Vitest`, `gate` as `null` → AC-7
- [x] Read `test/db.ts`, `test/clerk.ts`, and `test/factories.ts` → each standing rule lives in the helper it belongs to → AC-10

## Value sources (vary the source, watch the output follow)

- [x] Change `PLAN_LIMITS[PLANS.FREE].maxSessionsPerMonth` to 2, run `npm test` → the ceiling test still refuses and its message names 2, with no test edited → AC-5
- [x] Change `getCurrentBillingPeriodStart()` to return a date two months back, run `npm test` → the allowance test still counts 1, and the earlier period test still passes because its stamp moves with the source → AC-5
- [x] Sign in as `OTHER_READER_ID` on `PLANS.STANDARD` and check `plan` and `limit` → both follow `PLAN_LIMITS[PLANS.STANDARD]`, through the real `getUserPlan()` and the fake's `has()` answer → AC-5
- [x] Change the card's link to `/books/${slug}?x=1`, run `npm test` → the card test fails, so it asserts the component's own destination rather than a copy → AC-6

## Acceptance-criteria coverage

- AC-1 → the `npm test` passing and failing steps
- AC-2 → the coverage and watch steps
- AC-3 → the `npm test` step plus the guard step
- AC-4 → the poisoned environment step and the guard step
- AC-5 → the four value source steps and the first test file
- AC-6 → `components/BookCard.test.tsx` and the link change step
- AC-7 → the `test-preferences.json` step
- AC-8 → the cached binary, renamed environment file, and grep steps
- AC-9 → the typecheck and build steps
- AC-10 → the helper module step
