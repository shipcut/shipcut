import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import {
  AGENTS,
  STARTER_SCENARIO,
  detectAgents,
  devServer,
  ffmpegInstall,
} from "./lib.ts";
import type { Agent, InitOptions, PackageJson } from "./lib.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const readJson = (file: string) =>
  JSON.parse(readFileSync(file, "utf-8")) as PackageJson;

export const VERSION = readJson(join(ROOT, "package.json")).version ?? "";
const WINDOWS = process.platform === "win32";

const ok = (text: string) => console.log(`  ✓ ${text}`);
const no = (text: string) => console.log(`  ✗ ${text}`);
const note = (text: string) => console.log(`    ${text}`);
const heading = (text: string) => console.log(`\n${text}`);

function prompter(yes: boolean) {
  const interactive = !yes && process.stdin.isTTY && process.stdout.isTTY;
  const rl = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : undefined;
  return {
    interactive,
    async confirm(question: string, fallback = true): Promise<boolean> {
      if (!rl) return fallback;
      const answer = (
        await rl.question(`  ? ${question} ${fallback ? "[Y/n]" : "[y/N]"} `)
      )
        .trim()
        .toLowerCase();
      return answer ? answer.startsWith("y") : fallback;
    },
    async text(question: string, fallback: string): Promise<string> {
      if (!rl) return fallback;
      return (
        (await rl.question(`  ? ${question} (${fallback}) `)).trim() || fallback
      );
    },
    close: () => rl?.close(),
  };
}

const run = (command: string, args: string[]) =>
  spawnSync(command, args, { stdio: "inherit", shell: WINDOWS }).status === 0;

const output = (command: string, args: string[]) => {
  const done = spawnSync(command, args, { encoding: "utf-8", shell: WINDOWS });
  return done.status === 0 ? done.stdout : undefined;
};

/**
 * The `shipcut` a new shell finds. npx, pnpm dlx and bunx put their own
 * throwaway copy on PATH while they run, and that one does not count.
 */
function installedShipcut(): string | undefined {
  const names = WINDOWS ? ["shipcut.cmd", "shipcut.exe"] : ["shipcut"];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    for (const name of names) {
      const file = join(dir, name);
      if (!existsSync(file)) continue;
      const real = realpathSync(file);
      if (/[\\/](_npx|dlx)[\\/]|bunx-/.test(real)) continue;
      return file;
    }
  }
  return undefined;
}

async function project(o: InitOptions, ask: ReturnType<typeof prompter>) {
  heading("Project");
  const cwd = process.cwd();
  const pkgFile = join(cwd, "package.json");
  const pkg = existsSync(pkgFile) ? readJson(pkgFile) : undefined;
  const server = devServer(pkg ?? {});
  if (pkg)
    ok(
      `${pkg.name ?? cwd}${server.framework ? `, ${server.framework}` : ""}, dev server at ${server.url}`
    );
  else note(`No package.json in ${cwd}, so the dev server's port is a guess.`);
  const base =
    o.base ?? (await ask.text("Where does your app run?", server.url));
  return { cwd, base: base.replace(/\/$/, "") };
}

async function cli(ask: ReturnType<typeof prompter>): Promise<boolean> {
  heading("shipcut");
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 24) ok(`Node ${process.versions.node}`);
  else {
    no(`Node ${process.versions.node}; shipcut needs Node 24`);
    note("nvm install 24, or https://nodejs.org");
  }

  const found = installedShipcut();
  const version = found ? output(found, ["--version"])?.trim() : undefined;
  if (found && version === VERSION) {
    ok(`shipcut ${version} on PATH`);
    return major >= 24;
  }
  const install = ["install", "-g", `shipcut@${VERSION}`];
  const question = found
    ? `${version ? `shipcut ${version}` : "An older shipcut"} is on PATH. Update it to ${VERSION}?`
    : `Install shipcut ${VERSION} with npm install -g, so you and your agent can run it?`;
  if (!(await ask.confirm(question))) {
    note(`Later: npm ${install.join(" ")}`);
    return false;
  }
  if (run("npm", install)) {
    ok(`shipcut ${VERSION} installed`);
    return major >= 24;
  }
  no("npm could not install it globally");
  note(
    `Run it yourself, with sudo if npm's global folder needs it: npm ${install.join(" ")}`
  );
  return false;
}

async function browser(ask: ReturnType<typeof prompter>): Promise<boolean> {
  heading("Chromium");
  const require = createRequire(import.meta.url);
  const manifest = require.resolve("playwright/package.json");
  const playwrightVersion = readJson(manifest).version ?? "";
  const { chromium } = await import("playwright");
  if (existsSync(chromium.executablePath())) {
    ok(`Chromium for Playwright ${playwrightVersion}`);
    return true;
  }
  if (
    !(await ask.confirm(
      `Download the Chromium Playwright ${playwrightVersion} drives (about 170 MB)?`
    ))
  ) {
    note(`Later: npx playwright@${playwrightVersion} install chromium`);
    return false;
  }
  if (
    spawnSync(
      process.execPath,
      [join(dirname(manifest), "cli.js"), "install", "chromium"],
      { stdio: "inherit" }
    ).status === 0
  ) {
    ok("Chromium downloaded");
    if (process.platform === "linux")
      note(
        `If it will not start for a missing library: sudo npx playwright@${playwrightVersion} install-deps chromium`
      );
    return true;
  }
  no("The download failed");
  note(`Retry: npx playwright@${playwrightVersion} install chromium`);
  return false;
}

function ffmpeg(): boolean {
  heading("ffmpeg");
  const osRelease =
    process.platform === "linux" && existsSync("/etc/os-release")
      ? readFileSync("/etc/os-release", "utf-8")
      : "";
  const decoders = output("ffmpeg", ["-hide_banner", "-decoders"]);
  const probe = output("ffprobe", ["-version"]);
  if (decoders?.includes("librsvg") && probe !== undefined) {
    ok("ffmpeg with librsvg, and ffprobe");
    return true;
  }
  if (decoders === undefined) no("No ffmpeg on PATH");
  else if (decoders.includes("librsvg")) no("No ffprobe on PATH");
  else no("ffmpeg is built without librsvg, which polish needs to draw");
  note(ffmpegInstall(process.platform, osRelease, decoders !== undefined));
  note("Then run npx shipcut init again to check.");
  return false;
}

async function skill(
  o: InitOptions,
  cwd: string,
  ask: ReturnType<typeof prompter>
) {
  heading("Skill for your coding agent");
  const detected = detectAgents(readdirSync(cwd));
  let agents: Agent[] = o.agents ?? (detected.length ? detected : ["claude"]);
  if (!o.agents && ask.interactive) {
    const names = agents.map((key) => AGENTS[key].name).join(", ");
    if (!(await ask.confirm(`Add the shipcut skill for ${names}?`))) {
      const all = Object.keys(AGENTS).join(", ");
      const picked = await ask.text(
        `Which agents, of ${all}? Empty for none`,
        "none"
      );
      agents = picked
        .split(/[\s,]+/)
        .filter((key): key is Agent => key in AGENTS);
    }
  }
  if (!agents.length) {
    note("No skill added. Later: npx shipcut init --agent claude");
    return;
  }
  const source = join(ROOT, "skills/shipcut");
  const fresh = readFileSync(join(source, "SKILL.md"), "utf-8");
  for (const key of agents) {
    const target = join(cwd, AGENTS[key].dir, "shipcut");
    const file = join(target, "SKILL.md");
    const before = existsSync(file) ? readFileSync(file, "utf-8") : "";
    mkdirSync(target, { recursive: true });
    cpSync(source, target, { recursive: true });
    let state = "updated";
    if (!before) state = "added";
    else if (before === fresh) state = "up to date";
    ok(`${relative(cwd, file)} ${state}, for ${AGENTS[key].name}`);
  }
  note("Commit it, so everyone's agent has it.");
}

async function scenario(
  o: InitOptions,
  cwd: string,
  ask: ReturnType<typeof prompter>
): Promise<string | undefined> {
  const file = join(cwd, "shipcut/landing.ts");
  if (existsSync(file)) return "shipcut/landing.ts";
  if (!o.scenario || existsSync(join(cwd, "shipcut"))) return undefined;
  heading("First scenario");
  if (!(await ask.confirm("Write a first scenario to shipcut/landing.ts?")))
    return undefined;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, STARTER_SCENARIO);
  ok("shipcut/landing.ts opens your landing and takes one shot");
  return "shipcut/landing.ts";
}

async function publishing() {
  heading("Publishing");
  const missing = (await import("./store.ts")).missingCredentials();
  if (missing.length)
    note(
      `Optional. To publish to your R2 bucket, set ${missing.join(", ")}: https://shipcut.dev/docs/publishing`
    );
  else ok("R2 credentials found");
}

export async function init(o: InitOptions) {
  console.log(`shipcut ${VERSION} setup`);
  const ask = prompter(o.yes);
  if (!o.yes && !ask.interactive)
    note("No terminal to ask in, so every default is taken.");
  try {
    const { cwd, base } = await project(o, ask);
    const ready = [await cli(ask), await browser(ask), ffmpeg()];
    await skill(o, cwd, ask);
    const file = await scenario(o, cwd, ask);
    await publishing();

    heading("Next");
    const target = file ?? "<scenario>";
    note("Start your app, then record:");
    note(`shipcut run ${target} --base ${base} --video --pointer`);
    note("shipcut polish out/<run-id>");
    note(
      'Or ask your agent: "Use the shipcut skill to record the signup flow."'
    );
    if (ready.includes(false)) {
      console.log("\nSome checks failed. Fix the ✗ lines and run init again.");
      process.exitCode = 1;
    }
  } finally {
    ask.close();
  }
}
