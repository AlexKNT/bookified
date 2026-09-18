import { PricingTable } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { getSessionUsage } from "@/lib/actions/session.actions";
import { PLAN_LIMITS } from "@/lib/subscription-constants";
import { getUserPlan } from "@/lib/subscription.server";

const formatLimit = (value: number) => (Number.isFinite(value) ? String(value) : "Unlimited");

const Page = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const [plan, usage] = await Promise.all([getUserPlan(), getSessionUsage()]);
  const limits = PLAN_LIMITS[plan];

  return (
    <main className="clerk-subscriptions">
      <section className="flex flex-col items-center gap-4 text-center">
        <h1 className="page-title">Choose Your Plan</h1>
        <p className="page-description max-w-xl text-[var(--text-secondary)]">
          Conversations with your books are metered per month. Upgrade for more books, longer sessions,
          and session history.
        </p>
      </section>

      <section className="my-10 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="vapi-stat-box w-full !min-w-0">
          <p className="vapi-stat-label">Current plan</p>
          <p className="vapi-stat-value-lg capitalize">{plan}</p>
        </div>

        <div className="vapi-stat-box w-full !min-w-0">
          <p className="vapi-stat-label">Books</p>
          <p className="vapi-stat-value-lg">
            {usage.bookCount}/{formatLimit(limits.maxBooks)}
          </p>
        </div>

        <div className="vapi-stat-box w-full !min-w-0">
          <p className="vapi-stat-label">Conversations this month</p>
          <p className="vapi-stat-value-lg">
            {usage.sessionCount}/{formatLimit(limits.maxSessionsPerMonth)}
          </p>
        </div>
      </section>

      <div className="clerk-pricing-container">
        <div className="clerk-pricing-table-wrapper">
          <PricingTable />
        </div>
      </div>

      <p className="auth-footer">
        Plans are billed through Clerk Billing. Each session is also limited to{" "}
        {limits.maxDurationPerSession} minutes on the {plan} plan.
      </p>
    </main>
  );
};

export default Page;
