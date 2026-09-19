import { describe, expect, it } from "vitest";

import Book from "@/database/models/book.model";
import VoiceSession from "@/database/models/voice-session.model";
import { getCurrentBillingPeriodStart } from "@/lib/subscription-constants";
import { OTHER_READER_ID, READER_ID } from "@/test/clerk";
import { makeBook, makeSession } from "@/test/factories";

/**
 * The document factories `test/factories.ts` owns. Both save what they build,
 * because the actions under test query the database rather than a stub, so each
 * test here reads back through the model to prove the document landed.
 */

describe("makeBook", () => {
  // covers: AC-3, a document written through a model reaches the throwaway database.
  it("saves a book owned by the reading reader", async () => {
    const book = await makeBook();

    const stored = await Book.findById(book._id);

    expect(stored).not.toBeNull();
    expect(stored?.clerkId).toBe(READER_ID);
    expect(stored?.title).toBe(book.title);
    expect(stored?.slug).toBe(book.slug);
    expect(stored?.totalSegments).toBe(0);
  });

  it("gives every book it builds a slug of its own", async () => {
    const [first, second] = await Promise.all([makeBook(), makeBook()]);

    expect(first.slug).not.toBe(second.slug);
  });

  it("lets a test override a field", async () => {
    const book = await makeBook({
      title: "A Named Book",
      clerkId: OTHER_READER_ID,
      fileSize: 4096,
    });

    const stored = await Book.findById(book._id);

    expect(stored?.title).toBe("A Named Book");
    expect(stored?.clerkId).toBe(OTHER_READER_ID);
    expect(stored?.fileSize).toBe(4096);
  });

  it("fails loudly when an override breaks a model rule", async () => {
    await expect(makeBook({ slug: "" })).rejects.toThrow(/slug/);
  });
});

describe("makeSession", () => {
  // covers: AC-5, the period the metering query filters on comes from the source.
  it("stamps a session with the current billing period", async () => {
    const session = await makeSession();

    const stored = await VoiceSession.findById(session._id);

    expect(stored?.billingPeriodStart?.getTime()).toBe(getCurrentBillingPeriodStart().getTime());
  });

  // covers: AC-5, a session from an earlier period can be staged.
  it("stores the billing period a test stages", async () => {
    const earlier = new Date(2026, 0, 1);

    const session = await makeSession({ billingPeriodStart: earlier });

    expect(session.billingPeriodStart.getTime()).toBe(earlier.getTime());
  });

  // covers: AC-5, one reader's sessions never count towards another reader.
  it("keeps one reader's sessions out of another reader's count", async () => {
    await makeSession({ clerkId: OTHER_READER_ID });

    const period = getCurrentBillingPeriodStart();

    expect(
      await VoiceSession.countDocuments({ clerkId: READER_ID, billingPeriodStart: period }),
    ).toBe(0);
    expect(
      await VoiceSession.countDocuments({ clerkId: OTHER_READER_ID, billingPeriodStart: period }),
    ).toBe(1);
  });

  // covers: AC-3, the shipped dependency the factory documents.
  it("counts a session without a book row behind it", async () => {
    const session = await makeSession();

    expect(await Book.countDocuments({ _id: session.bookId.toString() })).toBe(0);
  });
});
