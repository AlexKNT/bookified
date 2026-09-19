import { randomUUID } from "node:crypto";

import { Types } from "mongoose";

import Book from "@/database/models/book.model";
import VoiceSession from "@/database/models/voice-session.model";
import { getCurrentBillingPeriodStart } from "@/lib/subscription-constants";
import { READER_ID } from "@/test/clerk";
import type { IBook, IVoiceSession } from "@/types";

/**
 * Document factories. Fixtures are invented data: no production document, book
 * text, or transcript is ever copied into a test.
 *
 * Both factories create the document and save it, because the actions under
 * test query the database rather than a stub.
 */

/** A book with the fields a real upload would have set. */
export const makeBook = async (overrides: Partial<IBook> = {}) => {
  const seed = randomUUID().replaceAll("-", "").slice(0, 12);

  return Book.create({
    clerkId: READER_ID,
    title: `A Test Book ${seed}`,
    slug: `a-test-book-${seed}`,
    author: "Test Author",
    fileURL: `https://example.test/books/${seed}.pdf`,
    fileBlobKey: `books/${seed}.pdf`,
    fileSize: 2048,
    totalSegments: 0,
    ...overrides,
  });
};

/**
 * One metered conversation. It belongs to the current billing period unless
 * `billingPeriodStart` says otherwise, which is how a test stages a session
 * from an earlier period.
 */
export const makeSession = async (overrides: Partial<IVoiceSession> = {}) => {
  return VoiceSession.create({
    clerkId: READER_ID,
    // The metering query filters on `clerkId` and `billingPeriodStart` only, so
    // a book does not have to exist for a session to be counted.
    bookId: new Types.ObjectId(),
    startedAt: new Date(),
    durationSeconds: 0,
    billingPeriodStart: getCurrentBillingPeriodStart(),
    ...overrides,
  });
};
