# Database

## Overview

The MongoDB layer for Bookified, built on Mongoose. Every document belongs to a Clerk user, so each model carries a `clerkId` field and every query is scoped by it. A book is stored in two places: the `Book` document holds the file and cover metadata, and `BookSegment` documents hold the extracted text the voice assistant reads from.

## Key files

| File | Owns |
|---|---|
| `mongoose.ts` | The `connectToDatabase` helper and the global connection cache |
| `models/book.model.ts` | Book metadata, the unique slug, and the owner field |
| `models/book-segment.model.ts` | Text chunks per book plus the lookup index |
| `models/voice-session.model.ts` | Metered conversation sessions, one row per call |

## Conventions

- Call `connectToDatabase()` at the start of every server action that touches the database. It returns the cached connection and throws when `MONGODB_URI` is missing.
- Filter every query by the `clerkId` from Clerk `auth()`. Never look a document up by `_id` alone.
- Reuse the Models type guard: `(models.X as Model<X>) ?? model<X>("X", Schema)`. It keeps hot reload from redefining a model.
- Document interfaces live in `types.d.ts`, not beside the schema. Import them with `@/types`.
- Keep `timestamps: true` on new schemas.

## Gotchas

- The connection is cached on `global.mongooseCache` on purpose, so hot reloads do not open a new pool each time.
- `bufferCommands` is `false`, which means a query issued before the connection resolves fails instead of waiting.
- Book slugs are unique. `generateUniqueSlug` in `lib/actions/book.actions.ts` appends a number when a title collides, so do not build a slug by hand.
- The compound index on `bookId` and `segmentIndex` serves the ordered segment read that the assistant does on every call. Changing how segments are ordered or written means revisiting that index.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
