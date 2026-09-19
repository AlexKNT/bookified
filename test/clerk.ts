import { beforeEach, vi } from "vitest";

import { PLANS, type PlanType } from "@/lib/subscription-constants";

/**
 * The Clerk fake.
 *
 * Every test file replaces the real server module with this one, using a single
 * top level line:
 *
 * ```ts
 * vi.mock("@clerk/nextjs/server", () => import("@/test/clerk"));
 * ```
 *
 * That line has to live in the test file itself, because the runner hoists it
 * and a helper module cannot hoist on the file's behalf. This module holds the
 * state the line hands back, so no Clerk key is needed and no Clerk call is
 * ever made.
 *
 * The real `lib/subscription.server.ts` stays in the path: the fake answers
 * both `auth()` and its `has()` plan check, so `getUserPlan()` is exercised
 * rather than stubbed.
 */

/** The reader a test acts as unless it says otherwise. */
export const READER_ID = "user_test_reader_one";

/** A second reader, so a test can prove one reader cannot reach another's documents. */
export const OTHER_READER_ID = "user_test_reader_two";

interface Session {
  userId: string | null;
  plan: PlanType;
}

const signedOut: Session = { userId: null, plan: PLANS.FREE };

let session: Session = signedOut;

/**
 * Acts as `userId` on `plan`, or, called with no arguments, acts as a signed
 * out visitor.
 */
export const signInAs = (userId?: string, options?: { plan?: PlanType }): void => {
  session =
    userId === undefined
      ? signedOut
      : { userId, plan: options?.plan ?? PLANS.FREE };
};

/** The plan check `getUserPlan()` reads. */
const has = (params?: { plan?: PlanType }): boolean => {
  if (!session.userId) return false;

  return params?.plan === session.plan;
};

export const auth = vi.fn(async () => ({
  userId: session.userId,
  sessionId: session.userId === null ? null : `sess_test_${session.userId}`,
  orgId: null,
  has,
}));

// Every test starts signed out, so the state of one test can never leak into
// the next.
beforeEach(() => {
  signInAs();
});
