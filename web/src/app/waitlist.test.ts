// The waitlist action with Resend stubbed.
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { joinWaitlist } from "./waitlist.ts";

const IDLE = { status: "idle", message: "" } as const;
const join = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return joinWaitlist(IDLE, form);
};

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_secret";
  process.env.WAITLIST_FROM = "shipcut <waitlist@example.com>";
  process.env.WAITLIST_TO = "roman@example.com";
});
afterEach(() => mock.restoreAll());

const stubResend = (response = new Response("{}", { status: 200 })) =>
  mock.method(globalThis, "fetch", () => Promise.resolve(response));

test("an address sends Roman one mail through Resend, with where it came from", async () => {
  const resend = stubResend();
  assert.deepEqual(await join({ email: "  ada@example.com ", source: "x" }), {
    status: "ok",
    message: "You're on the list.",
  });
  assert.equal(resend.mock.callCount(), 1);
  const [url, init] = resend.mock.calls[0]?.arguments ?? [];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init?.method, "POST");
  assert.deepEqual(init?.headers, {
    authorization: "Bearer re_secret",
    "content-type": "application/json",
  });
  assert.deepEqual(JSON.parse(init?.body as string), {
    from: "shipcut <waitlist@example.com>",
    to: "roman@example.com",
    reply_to: "ada@example.com",
    subject: "Waitlist: ada@example.com",
    text: "ada@example.com joined the shipcut waitlist from x.",
  });
});

test("a source that is not a plain word stays out of the mail", async () => {
  const resend = stubResend();
  await join({ email: "ada@example.com", source: "x\nbcc: eve@example.com" });
  const body = JSON.parse(
    resend.mock.calls[0]?.arguments[1]?.body as string
  ) as { text: string };
  assert.equal(body.text, "ada@example.com joined the shipcut waitlist.");
});

test("anything but one address is an error and sends nothing", async () => {
  const resend = stubResend();
  for (const email of [
    "",
    "ada",
    "ada@example",
    "ada@example.com\r\nbcc: eve@example.com",
    `${"a".repeat(250)}@example.com`,
  ]) {
    assert.equal((await join({ email })).status, "error");
  }
  assert.equal((await join({})).status, "error");
  assert.equal(resend.mock.callCount(), 0);
});

test("a Resend failure does not leak the key", async () => {
  stubResend(new Response('{"message":"API key is invalid"}', { status: 401 }));
  mock.method(console, "error", () => {});
  const state = await join({ email: "ada@example.com" });
  assert.equal(state.status, "error");
  assert.doesNotMatch(state.message, /re_secret|API key/);
});

test("missing configuration sends nothing", async () => {
  const resend = stubResend();
  mock.method(console, "error", () => {});
  delete process.env.RESEND_API_KEY;
  assert.equal((await join({ email: "ada@example.com" })).status, "error");
  assert.equal(resend.mock.callCount(), 0);
});
