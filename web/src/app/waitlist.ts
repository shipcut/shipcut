"use server";

// The waitlist: one email address in, one mail to Roman through Resend out.
// No cookie, no database, no mail to the person who signed up.

const RESEND = "https://api.resend.com/emails";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE = /^[\w-]{1,32}$/;

export interface WaitlistState {
  status: "idle" | "ok" | "error";
  message: string;
}

/** For `useActionState`: the form's `email`, and `source`, the visit's utm_source if it had one. */
export async function joinWaitlist(
  _: WaitlistState,
  form: FormData
): Promise<WaitlistState> {
  const email = readEmail(form.get("email"));
  if (!email)
    return { status: "error", message: "Enter a valid email address." };
  const source = form.get("source");
  const from =
    typeof source === "string" && SOURCE.test(source) ? source : undefined;

  const {
    RESEND_API_KEY: key,
    WAITLIST_FROM: sender,
    WAITLIST_TO: to,
  } = process.env;
  if (!key || !sender || !to) {
    console.error(
      "waitlist: RESEND_API_KEY, WAITLIST_FROM or WAITLIST_TO is not set"
    );
    return {
      status: "error",
      message: "The waitlist is down. Write to hello@shipcut.dev instead.",
    };
  }

  try {
    const sent = await fetch(RESEND, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to,
        reply_to: email,
        subject: `Waitlist: ${email}`,
        text: `${email} joined the shipcut waitlist${from ? ` from ${from}` : ""}.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!sent.ok) {
      console.error(
        `waitlist: Resend answered ${sent.status}: ${await sent.text()}`
      );
      return {
        status: "error",
        message: "Could not add you. Try again in a minute.",
      };
    }
  } catch (error) {
    console.error("waitlist: Resend unreachable:", error);
    return {
      status: "error",
      message: "Could not add you. Try again in a minute.",
    };
  }
  return { status: "ok", message: "You're on the list." };
}

function readEmail(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const email = value.trim();
  return email.length <= 254 && EMAIL.test(email) ? email : undefined;
}
