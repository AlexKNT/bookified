import { describe, expect, it, vi } from "vitest";

// The runner hoists this line above the imports, so the real Clerk module is
// replaced before any application code loads it. It has to sit in the test file
// itself: a helper module cannot hoist on the file's behalf.
vi.mock("@clerk/nextjs/server", () => import("@/test/clerk"));

import { checkSessionLimit } from "@/lib/actions/session.actions";
import { PLANS, PLAN_LIMITS, getCurrentBillingPeriodStart } from "@/lib/subscription-constants";
import { OTHER_READER_ID, READER_ID, signInAs } from "@/test/clerk";
import { makeSession } from "@/test/factories";

// Every limit below is read from PLAN_LIMITS, so changing a plan is a one file
// change and never breaks this file.
const freeLimits = PLAN_LIMITS[PLANS.FREE];

const previousBillingPeriodStart = (): Date => {
  const current = getCurrentBillingPeriodStart();
  return new Date(current.getFullYear(), current.getMonth() - 1, 1);
};

const fillCurrentPeriod = async (clerkId: string) => {
  for (let index = 0; index < freeLimits.maxSessionsPerMonth; index += 1) {
    await makeSession({ clerkId });
  }
};

describe("checkSessionLimit", () => {
  it("allows a conversation while the reader is under their limit", async () => {
    signInAs(READER_ID, { plan: PLANS.FREE });
    await makeSession();

    const result = await checkSessionLimit();

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(1);
    expect(result.limit).toBe(freeLimits.maxSessionsPerMonth);
    expect(result.plan).toBe(PLANS.FREE);
    expect(result.maxDurationMinutes).toBe(freeLimits.maxDurationPerSession);
    expect(result.error).toBeUndefined();
  });

  it("refuses the next conversation at the limit, with the plan's own message", async () => {
    signInAs(READER_ID, { plan: PLANS.FREE });
    await fillCurrentPeriod(READER_ID);

    const result = await checkSessionLimit();

    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(freeLimits.maxSessionsPerMonth);
    expect(result.limit).toBe(freeLimits.maxSessionsPerMonth);
    expect(result.error).toBe(
      `You have used all ${freeLimits.maxSessionsPerMonth} conversations on the ${PLANS.FREE} plan this month.`,
    );
  });

  it("asks a signed out visitor to sign in instead of answering the limit", async () => {
    signInAs();

    const result = await checkSessionLimit();

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Please sign in to start a conversation");
  });

  it("does not count conversations stamped in an earlier billing period", async () => {
    signInAs(READER_ID, { plan: PLANS.FREE });

    for (let index = 0; index < freeLimits.maxSessionsPerMonth; index += 1) {
      await makeSession({ billingPeriodStart: previousBillingPeriodStart() });
    }

    const result = await checkSessionLimit();

    expect(result.currentCount).toBe(0);
    expect(result.allowed).toBe(true);
  });

  it("never counts another reader's conversations", async () => {
    signInAs(READER_ID, { plan: PLANS.FREE });
    await fillCurrentPeriod(OTHER_READER_ID);

    const result = await checkSessionLimit();

    expect(result.currentCount).toBe(0);
    expect(result.allowed).toBe(true);
  });
});
