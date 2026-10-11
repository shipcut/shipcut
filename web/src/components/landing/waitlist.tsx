"use client";

import { track } from "@vercel/analytics";
import { useActionState } from "react";

import { PLANS, type Plan } from "@/app/plans";
import { type WaitlistState, joinWaitlist } from "@/app/waitlist";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { utmSource } from "./visit-source";

const IDLE: WaitlistState = { status: "idle", message: "" };
/** The submit button's text, idle and pending. */
const SUBMIT = {
  join: ["Join", "Joining"],
  reserve: ["Reserve", "Reserving"],
} as const;

/**
 * A button that opens the waitlist for hosted shipcut in a dialog. The
 * trigger's text is its children. With a `plan` the same form reserves that
 * plan's founding price.
 */
export function Waitlist({
  className,
  size = "lg",
  variant = "default",
  plan,
  children = "Join the waitlist",
}: {
  className?: string;
  size?: "default" | "lg";
  variant?: "default" | "outline" | "link";
  plan?: Plan;
  children?: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button size={size} variant={variant} className={className} />}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="border-line gap-5 border p-6 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {plan
              ? `shipcut ${PLANS[plan].name}, ${PLANS[plan].price} EUR a month`
              : "shipcut hosted"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {plan
              ? "Reserving is free. The founding price stays yours for as long as you keep the plan, and Roman writes to you before anything is charged."
              : "One email when it opens: a re-render on every deploy from CI, a stable link and a player for every video. Nothing else."}
          </DialogDescription>
        </DialogHeader>
        <WaitlistForm plan={plan} />
      </DialogContent>
    </Dialog>
  );
}

function WaitlistForm({ plan }: { plan?: Plan }) {
  const [state, submit, pending] = useActionState(
    async (previous: WaitlistState, form: FormData) => {
      const source = utmSource();
      if (source) form.set("source", source);
      if (plan) form.set("plan", plan);
      const next = await joinWaitlist(previous, form);
      if (next.status === "ok") {
        track(plan ? "Reserve" : "Waitlist", {
          source: source ?? "none",
          ...(plan && { plan }),
        });
      }
      return next;
    },
    IDLE
  );

  if (state.status === "ok") {
    return (
      <div className="grid gap-3">
        <p className="text-lavender text-lg font-medium">{state.message}</p>
        {state.checkout && (
          <p className="text-haze">
            Want it locked now?{" "}
            <a
              href={state.checkout}
              onClick={() => track("Checkout", { plan: plan ?? "none" })}
              className="text-paper underline underline-offset-4"
            >
              Pay the first month
            </a>
            , refunded in full if hosted shipcut does not open.
          </p>
        )}
      </div>
    );
  }
  return (
    <form action={submit} className="grid gap-3">
      <label htmlFor="waitlist-email" className="sr-only">
        Email
      </label>
      <Input
        id="waitlist-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        aria-invalid={state.status === "error" || undefined}
        aria-describedby={state.message ? "waitlist-answer" : undefined}
        className="h-11 text-base"
      />
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-11 text-base"
      >
        {SUBMIT[plan ? "reserve" : "join"][pending ? 1 : 0]}
      </Button>
      {state.message && (
        <p
          id="waitlist-answer"
          role="alert"
          className="text-destructive text-sm"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
