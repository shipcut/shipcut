"use client";

import { track } from "@vercel/analytics";
import { useActionState } from "react";

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

/** A button that opens the waitlist for hosted shipcut in a dialog. The trigger's text is its children. */
export function Waitlist({
  className,
  size = "lg",
  variant = "default",
  children = "Join the waitlist",
}: {
  className?: string;
  size?: "default" | "lg";
  variant?: "default" | "outline" | "link";
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
            shipcut hosted
          </DialogTitle>
          <DialogDescription className="text-base">
            One email when it opens: a re-render on every deploy from CI, a
            stable link and a player for every video. Nothing else.
          </DialogDescription>
        </DialogHeader>
        <WaitlistForm />
      </DialogContent>
    </Dialog>
  );
}

function WaitlistForm() {
  const [state, submit, pending] = useActionState(
    async (previous: WaitlistState, form: FormData) => {
      const source = utmSource();
      if (source) form.set("source", source);
      const next = await joinWaitlist(previous, form);
      if (next.status === "ok") track("Waitlist", { source: source ?? "none" });
      return next;
    },
    IDLE
  );

  if (state.status === "ok") {
    return <p className="text-lavender text-lg font-medium">{state.message}</p>;
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
        {pending ? "Joining" : "Join"}
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
