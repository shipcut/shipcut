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

/** A button that opens the waitlist form in a dialog. */
export function Waitlist({
  className,
  size = "lg",
}: {
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size={size} className={className} />}>
        Join the waitlist
      </DialogTrigger>
      <DialogContent className="border-line gap-5 border p-7 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Join the waitlist
          </DialogTitle>
          <DialogDescription className="text-base">
            One email when shipcut can run on your app. Nothing else.
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
      <p
        id="waitlist-answer"
        aria-live="polite"
        className="text-destructive min-h-5 text-sm"
      >
        {state.message}
      </p>
    </form>
  );
}
