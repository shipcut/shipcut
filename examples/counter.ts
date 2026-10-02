// A self-contained scenario: it serves its own page, so it needs no --base and
// no network. `shots run examples/counter.ts --video --cursor`
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Scenario } from "../src/run.ts";

const PAGE = `<!doctype html><meta charset="utf-8"><title>Counter</title>
<style>
  body { margin: 0; height: 100vh; display: grid; place-content: center; gap: 24px;
    background: #000; color: #fff; font: 600 96px system-ui; text-align: center }
  button { font: 600 28px system-ui; padding: 16px 32px; background: #fff; color: #000; border: 0 }
</style>
<output id="count">0</output>
<button onclick="count.textContent = Number(count.textContent) + 1">Add one</button>`;

const scenario: Scenario = async ({ page, shot, step }) => {
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end(PAGE);
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    step("An empty counter");
    await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
    await shot("empty");

    step("Three clicks");
    const add = page.getByRole("button", { name: "Add one" });
    for (let i = 0; i < 3; i++) {
      await add.click();
      await page.waitForTimeout(400);
    }
    await page.getByText("3", { exact: true }).waitFor();
    await shot("three");
  } finally {
    server.close();
  }
};

export default scenario;
