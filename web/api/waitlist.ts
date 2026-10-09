// POST /api/waitlist: takes one email address and mails it to Roman through
// Resend. No cookie, no database, no mail to the person who signed up.
// The page's script gets plain text back; a form posted without JavaScript
// gets a small HTML page.

const RESEND = "https://api.resend.com/emails";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request): Promise<Response> {
  const html = request.headers.get("accept")?.includes("text/html") ?? false;
  const answer = (status: number, message: string) =>
    new Response(html ? page(message) : message, {
      status,
      headers: { "content-type": `${html ? "text/html" : "text/plain"}; charset=utf-8` },
    });

  const email = await readEmail(request);
  if (!email) return answer(400, "Enter a valid email address.");

  const { RESEND_API_KEY: key, WAITLIST_FROM: from, WAITLIST_TO: to } = process.env;
  if (!key || !from || !to) {
    console.error("waitlist: RESEND_API_KEY, WAITLIST_FROM or WAITLIST_TO is not set");
    return answer(500, "The waitlist is down. Write to hello@shipcut.dev instead.");
  }

  try {
    const sent = await fetch(RESEND, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        reply_to: email,
        subject: `Waitlist: ${email}`,
        text: `${email} joined the shipcut waitlist.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!sent.ok) {
      console.error(`waitlist: Resend answered ${sent.status}: ${await sent.text()}`);
      return answer(502, "Could not add you. Try again in a minute.");
    }
  } catch (error) {
    console.error("waitlist: Resend unreachable:", error);
    return answer(502, "Could not add you. Try again in a minute.");
  }
  return answer(200, "You're on the list");
}

/** The address from a JSON body `{ "email": ... }` or a form body `email=...`, if it looks like one. */
async function readEmail(request: Request): Promise<string | undefined> {
  const body = await request.text();
  let value: unknown;
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const json: unknown = JSON.parse(body);
      if (typeof json === "object" && json !== null && "email" in json) value = json.email;
    } catch {
      return undefined;
    }
  } else {
    value = new URLSearchParams(body).get("email");
  }
  if (typeof value !== "string") return undefined;
  const email = value.trim();
  return email.length <= 254 && EMAIL.test(email) ? email : undefined;
}

// Only ever given the fixed messages above, never the address.
const page = (message: string) => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>shipcut</title>
<style>body{margin:0;padding:32px 16px;background:#000;color:#fff;font:18px/1.5 system-ui,sans-serif}a{color:#fff}</style>
<p>${message}</p>
<p><a href="/">Back to shipcut</a></p>
</html>`;
