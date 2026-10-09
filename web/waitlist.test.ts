// The waitlist function with Resend stubbed. It lives outside `api/` because
// Vercel turns every file there into a function, tests included.
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { POST } from "./api/waitlist.ts";

const ENDPOINT = "https://shipcut.dev/api/waitlist";
const form = (email: string, accept = "*/*") =>
  new Request(ENDPOINT, { method: "POST", body: new URLSearchParams({ email }), headers: { accept } });
const json = (body: string) =>
  new Request(ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json" } });

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_secret";
  process.env.WAITLIST_FROM = "shipcut <hello@shipcut.dev>";
  process.env.WAITLIST_TO = "roman@example.com";
});
afterEach(() => mock.restoreAll());

const stubResend = (response = new Response("{}", { status: 200 })) =>
  mock.method(globalThis, "fetch", async () => response);

test("a form post sends Roman one mail through Resend", async () => {
  const resend = stubResend();
  const response = await POST(form("  ada@example.com "));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "You're on the list");
  assert.equal(resend.mock.callCount(), 1);
  const [url, init] = resend.mock.calls[0]?.arguments ?? [];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init?.method, "POST");
  assert.deepEqual(init?.headers, { authorization: "Bearer re_secret", "content-type": "application/json" });
  assert.deepEqual(JSON.parse(String(init?.body)), {
    from: "shipcut <hello@shipcut.dev>",
    to: "roman@example.com",
    reply_to: "ada@example.com",
    subject: "Waitlist: ada@example.com",
    text: "ada@example.com joined the shipcut waitlist.",
  });
});

test("JSON works too, and a browser without JavaScript gets a page", async () => {
  stubResend();
  assert.equal(await (await POST(json('{"email":"ada@example.com"}'))).text(), "You're on the list");
  const page = await POST(form("ada@example.com", "text/html,application/xhtml+xml"));
  assert.match(page.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(await page.text(), /<p>You're on the list<\/p>/);
});

test("anything but one address is a 400 and sends nothing", async () => {
  const resend = stubResend();
  for (const request of [
    form(""),
    form("ada"),
    form("ada@example"),
    form("ada@example.com\r\nbcc: eve@example.com"),
    form(`${"a".repeat(250)}@example.com`),
    json("{"),
    json("null"),
    json('{"email":["ada@example.com"]}'),
    new Request(ENDPOINT, { method: "POST" }),
  ]) {
    assert.equal((await POST(request)).status, 400);
  }
  assert.equal(resend.mock.callCount(), 0);
});

test("a Resend failure is a 502 that does not leak the key", async () => {
  stubResend(new Response('{"message":"API key is invalid"}', { status: 401 }));
  mock.method(console, "error", () => {});
  const response = await POST(form("ada@example.com"));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /re_secret|API key/);
});

test("missing configuration is a 500 and sends nothing", async () => {
  const resend = stubResend();
  mock.method(console, "error", () => {});
  delete process.env.RESEND_API_KEY;
  assert.equal((await POST(form("ada@example.com"))).status, 500);
  assert.equal(resend.mock.callCount(), 0);
});
