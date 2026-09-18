"use server";

import { auth } from "@clerk/nextjs/server";
import { Types } from "mongoose";

import connectToDatabase from "@/database/mongoose";
import Book from "@/database/models/book.model";
import VoiceSession from "@/database/models/voice-session.model";
import { PLANS, PLAN_LIMITS, getCurrentBillingPeriodStart } from "@/lib/subscription-constants";
import { getUserPlan } from "@/lib/subscription.server";
import type { EndSessionResult, SessionCheckResult, StartSessionResult } from "@/types";

const denied = (error: string): SessionCheckResult => ({
  allowed: false,
  currentCount: 0,
  limit: 0,
  plan: PLANS.FREE,
  maxDurationMinutes: 0,
  error,
});

/** Counts the signed-in user's sessions for the current billing period. */
export async function getSessionUsage() {
  const { userId } = await auth();

  if (!userId) {
    return { sessionCount: 0, bookCount: 0 };
  }

  try {
    await connectToDatabase();

    const [sessionCount, bookCount] = await Promise.all([
      VoiceSession.countDocuments({
        clerkId: userId,
        billingPeriodStart: getCurrentBillingPeriodStart(),
      }),
      Book.countDocuments({ clerkId: userId }),
    ]);

    return { sessionCount, bookCount };
  } catch (error) {
    console.error("getSessionUsage failed:", error);
    return { sessionCount: 0, bookCount: 0 };
  }
}

export async function checkSessionLimit(): Promise<SessionCheckResult> {
  const { userId } = await auth();

  if (!userId) return denied("Please sign in to start a conversation");

  try {
    await connectToDatabase();

    const plan = await getUserPlan();
    const limits = PLAN_LIMITS[plan];

    const currentCount = await VoiceSession.countDocuments({
      clerkId: userId,
      billingPeriodStart: getCurrentBillingPeriodStart(),
    });

    const allowed = currentCount < limits.maxSessionsPerMonth;

    return {
      allowed,
      currentCount,
      limit: limits.maxSessionsPerMonth,
      plan,
      maxDurationMinutes: limits.maxDurationPerSession,
      error: allowed
        ? undefined
        : `You have used all ${limits.maxSessionsPerMonth} conversations on the ${plan} plan this month.`,
    };
  } catch (error) {
    console.error("checkSessionLimit failed:", error);
    return denied("Failed to check your conversation limit");
  }
}

export async function startVoiceSession(bookId: string): Promise<StartSessionResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Please sign in to start a conversation" };
  }

  if (!Types.ObjectId.isValid(bookId)) {
    return { success: false, error: "Invalid book id" };
  }

  try {
    await connectToDatabase();

    const book = await Book.findOne({ _id: bookId, clerkId: userId }).select("_id").lean();

    if (!book) {
      return { success: false, error: "Book not found" };
    }

    const limitCheck = await checkSessionLimit();

    if (!limitCheck.allowed) {
      return { success: false, isBillingError: true, error: limitCheck.error };
    }

    const session = await VoiceSession.create({
      clerkId: userId,
      bookId: new Types.ObjectId(bookId),
      startedAt: new Date(),
      durationSeconds: 0,
      billingPeriodStart: getCurrentBillingPeriodStart(),
    });

    return {
      success: true,
      sessionId: String(session._id),
      maxDurationMinutes: limitCheck.maxDurationMinutes,
    };
  } catch (error) {
    console.error("startVoiceSession failed:", error);
    return { success: false, error: "Failed to start the conversation" };
  }
}

export async function endVoiceSession(
  sessionId: string,
  durationSeconds: number,
): Promise<EndSessionResult> {
  const { userId } = await auth();

  if (!userId) return { success: false, error: "Unauthorized" };

  if (!Types.ObjectId.isValid(sessionId)) {
    return { success: false, error: "Invalid session id" };
  }

  try {
    await connectToDatabase();

    const result = await VoiceSession.updateOne(
      { _id: sessionId, clerkId: userId },
      { endedAt: new Date(), durationSeconds: Math.max(0, Math.round(durationSeconds)) },
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "Session not found" };
    }

    return { success: true };
  } catch (error) {
    console.error("endVoiceSession failed:", error);
    return { success: false, error: "Failed to end the conversation" };
  }
}
