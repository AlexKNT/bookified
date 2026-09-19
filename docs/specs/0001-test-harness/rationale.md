# Rationale: test harness

## Context

> ⚠️ Premise note: a harness only pays for itself if something runs it. There is no pipeline in this repository, so today the only thing that makes `npm test` run is the workflow itself. That is an acceptable starting point, since the Beta stage closes each feature with `/test` and `/test` runs the suite as part of closing, but the honest reading is that this decision buys the ability to test, not the guarantee that testing happens. Revisit a pipeline once the suite has proven it catches real breakage, rather than adding a pipeline in the same breath as a first test.

Bookified has five features in production behaviour and no way to run a test. `package.json` offers `dev`, `build`, `start`, and `lint`, and nothing else. The workflow's Beta stage ends each feature with `/test`, and `/test` reads a preference file to learn which runner to use; with no file and no runner, every feature would open with the same framework conversation.

The code makes the gap concrete. Every server action begins with Clerk `auth()` and returns a result object rather than throwing, so the interesting behaviour sits behind an auth boundary. Every database call goes through `connectToDatabase()`, which memoises its connection on `global.mongooseCache` on purpose for hot reload, and sets `bufferCommands: false`, so a query issued before the connection resolves fails instead of waiting. The riskiest logic is the plan metering in `lib/actions/session.actions.ts` and the ownership scoping in both action files, and both are exactly the kind of code that looks right and is wrong.

Two constraints shaped everything below. Tests must run on a fresh checkout with no environment file and no credentials, because a suite that needs real keys invites somebody to paste one in. And tests must be able to prove the scoping rule, which means they need a database that behaves like a database rather than a stub that agrees with whatever the code asks.

## Options considered

### Option 1: Vitest with a throwaway MongoDB and a faked Clerk session

One runner covers plain functions, server actions, and React components. `.test.ts` files run in Node and `.test.tsx` files run in a DOM, from a single command. MongoDB is started inside the test run by `mongodb-memory-server` and thrown away afterwards. Clerk is faked at the module boundary, so the real plan lookup code still executes.

**Pros**:
- A real database is exercised, so query filters, the `clerkId` scoping rule, and the compound index are all under test.
- The Next.js 16.3.5 documentation in this repository ships a Vitest guide, so the setup follows the framework's own current advice rather than a community recipe.
- No secret is needed anywhere, which makes the suite safe on any machine.
- Components and server code share one command, one config, and one helper layer.

**Cons**:
- Needs Node 22.12 or newer, which is ahead of what the project records today.
- The first run on a new machine needs the network once to fetch the MongoDB binary, and each worker pays a second or so to start a real `mongod`.
- Faking Clerk's server module is our own invention; Clerk documents browser testing helpers only.

### Option 2: Jest through `next/jest`

The other runner Next.js documents, with its own Next aware transform, and the same throwaway database and Clerk fake as option 1.

**Pros**:
- Long established, enormous community, and `next/jest` handles the Next transforms for you.
- Most examples of testing Next.js code in the wild are written against it.

**Cons**:
- Slower, and its configuration is heavier for the same outcome.
- The environment is set once for the whole config rather than per kind of test, so either every logic test pays for a DOM it does not use, or components need a second config.
- Vitest's mocking and per project environments are the current, better suited tooling for a project that wants two environments from one command.

### Option 3: The built in `node:test` runner

Node's own runner with a small amount of hand rolled setup.

**Pros**:
- No runner dependency beyond Node itself, which suits a project that keeps its dependency list lean.
- Nothing new to learn for anybody who knows Node.

**Cons**:
- No component rendering, so the React half of this decision would need a separate tool anyway, defeating the "one command" goal.
- No mocking ergonomics, so the Clerk fake and the database lifecycle would both be hand built.
- The half of the project's code that is React would remain untested.

### Option 4: Mock the Mongoose models instead of running a database

Stub `Book`, `BookSegment`, and `VoiceSession` with a fake that records calls.

**Pros**:
- Fastest possible run, no binary to download, no server to start.
- No database state to manage or clean between tests.

**Cons**:
- The scoping filters, the count queries, and the index become untested, and those are the parts most likely to break.
- The fake has to grow to match every new query, so it becomes a second implementation of the data layer that nobody maintains.
- The standing rule the project cares most about, that every query is scoped by `clerkId`, would be asserted against our own fake rather than against Mongo.

## Rationale

Option 1 wins on one argument and one constraint. The argument: the code most worth testing here is the code that decides what a reader is allowed to see and how much they are allowed to spend, and both of those live in database queries with a `clerkId` filter. A test that runs against a fake proves the fake; a test that runs against MongoDB proves the query. The constraint: the project already has two things that must be exercised rather than assumed, the memoised connection on `global.mongooseCache` and `bufferCommands: false`, and both only show themselves against a real driver.

Jest was a genuine contender and nothing about it is wrong. It loses on shape: this decision needs two environments from one command, and Vitest expresses that as two projects in one config, while Jest would need a second configuration or a DOM that logic tests do not want. `node:test` is attractive for the size of the dependency list and unusable for the components, which are most of the remaining surface. Mocking the models was rejected for the reason above, that it replaces the risky code with our own approximation of it.

The build approach, Tracer Bullet, shapes the plan rather than the choice. The first milestone runs a single thread from the command in `package.json` all the way through the config, the helper, the faked session, and a real assertion against a real database, so that the harness is proven end to end before anything is added to it. That is why the coverage script, the preference file, and the artifact ignore rules sit in the last milestone rather than the first.

**Decisions taken here rather than asked** (each with the alternative that was next best):

- **Path alias and JSX**: `vite-tsconfig-paths` plus `@vitejs/plugin-react`. The plugin reads the existing path map, so `@/*` has one definition, and it avoids the trap where a hand written `@` alias also swallows scoped package names such as `@clerk/nextjs`. Runner up: a regex anchored alias with no extra dependency.
- **Imports over globals**: every test file imports `describe`, `it`, and `expect` from `vitest`. Nothing to declare in `tsconfig.json` and a missing import is a compile error. Runner up: `globals: true`.
- **Timeouts**: a raised hook timeout, because a cold `mongod` start is slower than the default budget, and a failing setup should be a real failure rather than a timeout. Runner up: leave the defaults and tolerate flakes.
- **An empty run fails**: no silent pass when no test file matches, so a config mistake is loud. Runner up: the framework default.
- **Fakes do not leak**: mocks are cleared and restored between tests, so a session faked in one test cannot answer for the next. Runner up: rely on the framework's new default of clearing without restoring.
- **Who owns the connection**: the helper connects before the file's tests run, empties the database before each test, and disconnects when the file ends. Runner up: let every test file connect for itself, which repeats the same three lines and walks straight into the `bufferCommands: false` trap.
- **The guard's evidence**: the live connection's host, port, and database name, compared against the throwaway server. The environment is not read a second time, because `database/mongoose.ts` captured the address once at module scope and a second read would prove nothing. Runner up: compare the environment value, which passes happily while the connection points somewhere else.
- **The preference file's fields**: all seven that `/test` reads, with a single `filePattern` and an explicit null `gate`. Runner up: write the fields that seemed relevant and leave the reader to infer the rest.
- **The session fake's shape**: `signInAs(readerId, { plan })`, so a paid plan is reachable and the real plan lookup runs. Runner up: a fake that always answers free, which leaves the plan branch untested and the helper promising more than it exposes.
- **The mock line's home**: each test file carries its own top level `vi.mock`, with the fake state held in the helper. Runner up: register the fake in a setup file, which the runner's hoisting rules make fragile.
- **`next/image` in the DOM**: substituted with a plain image in the setup file, because a DOM without a running Next server cannot serve the optimiser. Runner up: leave it in place and accept the warning noise.
- **Coverage**: the v8 provider, reported by its own script, with no threshold. Runner up: no coverage tooling at all.
- **Layout and naming**: `*.test.ts` and `*.test.tsx` beside the source file. Runner up: `__tests__` folders, which is what the Next.js example uses.
- **The MongoDB pin**: 8.2, written into the helper instead of taken from the library's default, so the engine cannot shift under the suite without a deliberate change. Runner up: whatever the library ships.
- **The helper split**: three small modules, one for the database lifecycle, one for the Clerk fake, one for factories, plus a setup file. Each has a single reason to change. Runner up: one larger helper file.
- **Later test kinds**: a route handler can be imported and called directly with `next/headers` faked the same way Clerk is. Pages that render async server components are not supported by the runner and fall to `/check verify`, which drives the real app. Runner up: an end to end browser suite, deliberately out of scope for now.

## Evidence from the landscape check

Checked on 2026 09 19, before the options were presented, so the recommendation rests on current facts rather than on memory:

- Vitest 5.0.1 is current, stable, requires a Vite of 6.4 or newer and Node 22.12 or newer, and treats `vite` as a peer dependency you install yourself. The older `workspace` setting is gone in favour of `projects`, and files run in separate processes through the pool and parallelism settings.
- Next.js 16.3.5 documents Vitest as its unit testing setup, locally at `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`, and still documents Jest alongside it with no stated preference.
- That guide uses `vite-tsconfig-paths` with `@vitejs/plugin-react` and a jsdom environment. It also sets `npm test` to plain `vitest`, which watches, so this spec deliberately deviates and runs once instead, because a watching process never exits and `/test` runs the command itself.
- Importing a file that starts with `"use server"` works in Vitest, because the directive is inert outside the Next compiler. There is no documented transformer required.
- `@testing-library/react` 16.3.3 supports React 19, with `@testing-library/user-event` 14.6.7 and `@testing-library/jest-dom` 7.0.1 as the standard companions. jsdom is what the official recipes use, and happy-dom, while faster, lacks some API surface.
- `mongodb-memory-server` 11.2.0 offers MongoDB 8.2 as its default binary and older lines on request, spawns a fresh `mongod` per instance, and is normally wired one instance per test file with a database name per file.
- Clerk publishes testing documentation for browser flows only, through `@clerk/testing`, which matches the already installed `clerk-testing` skill.

Two things could not be confirmed and are worth knowing before the build: the pairing of this library with Mongoose 9 is not documented anywhere official, though the tool only spawns a real server so the object mapper is not negotiated, and mocking `@clerk/nextjs/server` is a common practice but is not documented by Clerk.

Two honest limits, found when the finished spec was checked by an independent read:

- The address guard proves the connection is right once the harness is running. It cannot catch a harness that never started, so a setup file that fails to load shows up as the missing address error from `database/mongoose.ts` instead. Worth stating plainly rather than promising more than the check can do.
- The `vitest` skill installed during this decision says in its own header that it was generated from a Vitest 5.x beta. The skill is a pointer to conventions, not a version source, so the version recorded in this spec remains the one the landscape check observed on 2026 09 19.

## References

**Project sources**:
- `package.json`, which shows the scripts that exist today and the absence of any test tooling.
- `lib/actions/session.actions.ts` and `lib/actions/book.actions.ts`, for the result object shape, the `clerkId` scoping rule, and the plan metering.
- `lib/subscription.server.ts` and `lib/subscription-constants.ts`, which show that the plan arrives through Clerk's `has()` check and that the billing period comes from `getCurrentBillingPeriodStart()`.
- `database/mongoose.ts` and `database/AGENTS.md`, for the memoised connection, `bufferCommands: false`, and the compound index.
- `AGENTS.md` plus the nested `lib/`, `database/`, and `components/` context docs, for the stack and conventions.
- `docs/scope/scope.md`, feature 1 under Foundations, including its done condition.
- `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`, the framework's own guide for this exact version.
- `.gitignore`, which already ignores `/coverage` and does not yet ignore the runner's own artifact folder.
- The `vitest` skill installed during this decision, at `.agents/skills/vitest/`.

**Practices and standards**:
- A test that reaches a real database proves the query; a test that reaches a fake proves the fake.
- Tests must be able to run on a fresh checkout with no credentials, so secrets never migrate into test files.
- A suite that cannot fail loudly on misconfiguration will eventually pass for the wrong reason, which is why the address guard throws rather than warns.
- Foundational decisions get recorded once, so later features inherit a choice instead of repeating the conversation.

**Links** (verified during the landscape check on 2026 09 19, listed for a human to follow, not fetched again):
- Vitest migration guide: https://vitest.dev/guide/migration.html
- Vitest projects: https://vitest.dev/guide/projects
- Vitest environment: https://vitest.dev/guide/environment
- Vitest configuration reference: https://vitest.dev/config/
- Next.js Vitest guide: https://nextjs.org/docs/app/guides/testing/vitest
- Next.js testing overview: https://nextjs.org/docs/app/guides/testing
- Next.js Jest guide: https://nextjs.org/docs/app/guides/testing/jest
- mongodb-memory-server: https://github.com/typegoose/mongodb-memory-server
- mongodb-memory-server test runner examples: https://typegoose.github.io/mongodb-memory-server/docs/guides/integration-examples/test-runners
- Clerk testing overview: https://clerk.com/docs/guides/development/testing/overview
