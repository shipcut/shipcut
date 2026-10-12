#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

import {
  captionOptions,
  clipOptions,
  initOptions,
  measureOptions,
  polishOptions,
  runOptions,
} from "./lib.ts";

const USAGE = `shipcut init [--yes] [--agent claude|cursor|agents|none]... [--base URL] [--no-scenario]
shipcut run <scenario> [--base URL] [--out DIR] [--preset desktop|phone|post|story | --viewport WxH]
          [--scale N] [--video] [--frame-by-frame] [--pointer | --cursor] [--slow MS] [--storage-state FILE] [--locale xx] [--dark]
          [--mask] [--mask-selector CSS]...
shipcut clip <video> [--from S] [--to S] [--speed X] [--width W] [--gif] [--out FILE]
shipcut caption <run-dir> [--out FILE] [--font FILE]
shipcut polish <run-dir> [--[no-]labels] [--label-font FILE] [--[no-]zoom] [--zoom-factor N] [--[no-]frame] [--background SPEC] [--out FILE]
shipcut measure <run-dir>
shipcut publish <run-dir> --project NAME [--title TEXT]
shipcut list [--project NAME] [--limit N]
shipcut rm <project>/<run-id> [--yes]`;

const [command, ...args] = process.argv.slice(2);

/**
 * Runs this same command again under `heavy`, so the browser and ffmpeg sit in a
 * capped systemd scope and cannot starve the shared box. Returns undefined where
 * there is no `heavy`, and the caller records in this process.
 */
function underHeavy(): number | undefined {
  if (process.env.SHIPCUT_HEAVY) return undefined;
  const done = spawnSync(
    "heavy",
    [
      "--name",
      "shipcut",
      "--no-lock",
      "--mem",
      "1500M",
      "--need",
      "800",
      "--",
      ...process.argv,
    ],
    { stdio: "inherit", env: { ...process.env, SHIPCUT_HEAVY: "1" } }
  );
  if (done.error) return undefined;
  return done.status ?? 1;
}

try {
  if (command === "init") {
    await (await import("./init.ts")).init(initOptions(args));
  } else if (command === "--version" || command === "-v") {
    console.log((await import("./init.ts")).VERSION);
  } else if (command === "run") {
    const options = runOptions(args);
    const code = underHeavy();
    if (code !== undefined) process.exit(code);
    await (await import("./run.ts")).run(options);
  } else if (command === "clip" || command === "caption") {
    const options =
      command === "clip" ? clipOptions(args) : captionOptions(args);
    const code = underHeavy();
    if (code !== undefined) process.exit(code);
    const { clip, caption } = await import("./clip.ts");
    if ("input" in options) clip(options);
    else caption(options);
  } else if (command === "polish") {
    const options = polishOptions(args);
    const code = underHeavy();
    if (code !== undefined) process.exit(code);
    (await import("./clip.ts")).polish(options);
  } else if (command === "measure") {
    const { dir } = measureOptions(args);
    const code = underHeavy();
    if (code !== undefined) process.exit(code);
    (await import("./clip.ts")).measureRun(dir);
  } else if (command === "publish") {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: { project: { type: "string" }, title: { type: "string" } },
    });
    if (positionals.length !== 1)
      throw new Error(
        "usage: shipcut publish <run-dir> --project NAME [--title TEXT]"
      );
    await (
      await import("./store.ts")
    ).publish(positionals[0]!, values.project, values.title);
  } else if (command === "list") {
    const { values } = parseArgs({
      args,
      options: { project: { type: "string" }, limit: { type: "string" } },
    });
    await (
      await import("./store.ts")
    ).listRuns(values.project, Number(values.limit ?? 20) || 20);
  } else if (command === "rm") {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: { yes: { type: "boolean", default: false } },
    });
    await (await import("./store.ts")).remove(positionals[0], values.yes);
  } else {
    console.log(USAGE);
    process.exit(command && command !== "help" && command !== "--help" ? 2 : 0);
  }
} catch (error) {
  console.error(
    `shipcut: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
