import { describe, expect, it, vi } from "vitest";

// The runner hoists this line above the imports, so `auth()` below answers from
// the harness fake rather than from Clerk.
vi.mock("@clerk/nextjs/server", () => import("@/test/clerk"));

import { auth } from "@clerk/nextjs/server";

import { PLANS } from "@/lib/subscription-constants";
import { getUserPlan } from "@/lib/subscription.server";
import { OTHER_READER_ID, READER_ID, signInAs } from "@/test/clerk";

/**
 * The Clerk fake `test/clerk.ts` owns. Clerk documents browser testing helpers
 * only, so this fake is the piece most likely to drift when Clerk changes.
 * Everything here pins the answers every other test file depends on.
 */

describe("the Clerk session fake", () => {
  // covers: AC-5, the signed out case, and AC-10, the fake's own default.
  it("answers as a signed out visitor until a test signs in", async () => {
    const session = await auth();

    expect(session.userId).toBeNull();
    expect(session.sessionId).toBeNull();
    expect(session.has({ plan: PLANS.FREE })).toBe(false);
  });

  // covers: AC-5, the plan check the real plan lookup reads.
  it("answers as the reader signInAs names, on the plan it was given", async () => {
    signInAs(READER_ID, { plan: PLANS.STANDARD });

    const session = await auth();

    expect(session.userId).toBe(READER_ID);
    expect(session.sessionId).toContain(READER_ID);
    expect(session.has({ plan: PLANS.STANDARD })).toBe(true);
    expect(session.has({ plan: PLANS.PRO })).toBe(false);
  });

  // covers: AC-5, a signed in reader who names no plan is on free.
  it("puts a reader who names no plan on the free plan", async () => {
    signInAs(READER_ID);

    const session = await auth();

    expect(session.userId).toBe(READER_ID);
    expect(session.has({ plan: PLANS.FREE })).toBe(true);
  });

  it("gives a second reader an id of their own", async () => {
    signInAs(OTHER_READER_ID, { plan: PLANS.PRO });

    const session = await auth();

    expect(session.userId).toBe(OTHER_READER_ID);
    expect(session.userId).not.toBe(READER_ID);
  });
});

describe("the real plan lookup reading the fake", () => {
  // covers: AC-5, `lib/subscription.server.ts` stays real and reads the fake.
  it("reports the plan the fake answers with", async () => {
    signInAs(READER_ID, { plan: PLANS.STANDARD });

    expect(await getUserPlan()).toBe(PLANS.STANDARD);
  });

  it("reports free when nobody is signed in", async () => {
    expect(await getUserPlan()).toBe(PLANS.FREE);
  });
});
