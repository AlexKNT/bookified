import { describe, expect, it } from "vitest";

import mongoose from "mongoose";

import Book from "@/database/models/book.model";
import { READER_ID } from "@/test/clerk";
import { makeBook } from "@/test/factories";

/**
 * The database lifecycle `test/db.ts` owns, checked from inside the harness.
 *
 * `test/db.ts` is a setup file, so it has already replaced `MONGODB_URI` and
 * connected before this file loads. Everything below is about that setup rather
 * than about a feature.
 */

// The helper names its database `bookified_test_` plus a random value, which is
// what gives each test file a database of its own.
const THROWAWAY_DATABASE = /^bookified_test_[0-9a-f]{32}$/;
const THROWAWAY_URI = /^mongodb:\/\/127\.0\.0\.1:\d+\/bookified_test_[0-9a-f]{32}$/;

describe("the throwaway database", () => {
  // covers: AC-4, the address is replaced before any application code loads.
  it("puts the throwaway address in the environment", () => {
    expect(process.env.MONGODB_URI).toMatch(THROWAWAY_URI);
  });

  // covers: AC-4, the live connection is the throwaway server, never the cluster
  // named in `.env.local`.
  it("connects application code to the throwaway database", () => {
    expect(Book.db.host).toBe("127.0.0.1");
    expect(Book.db.name).toMatch(THROWAWAY_DATABASE);
    expect(Book.db.name).toBe(mongoose.connection.name);
    expect(mongoose.connection.port).toBeGreaterThan(0);
  });
});

describe("emptying between tests", () => {
  // These two run in order on purpose: "one test cannot see another test's
  // documents" is only observable as a sequence. Run shuffled or alone, the
  // second one still passes, it simply has nothing to prove.
  it("leaves a document behind for the next test to not find", async () => {
    await makeBook();

    expect(await Book.countDocuments({ clerkId: READER_ID })).toBe(1);
  });

  // covers: AC-3, the database is emptied before each test.
  it("starts on an empty database", async () => {
    expect(await Book.countDocuments({})).toBe(0);
  });
});
