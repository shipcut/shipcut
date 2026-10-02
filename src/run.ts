// `shots run`: drive a scenario in headless Chromium, keep the shots and the video.
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type BrowserContext, chromium, type Page } from "playwright";
import { contentType, FPS, framesDue, recordArgs, runId, type RunOptions, slug } from "./lib.ts";
import type { Run, RunFile, Step } from "./types.ts";

/** What a scenario's default export receives. */
export type ScenarioContext = {
  page: Page;
  /** `--base` without a trailing slash. */
  base: string;
  /** Saves `NN-name.png` of the viewport, or of the whole page with `fullPage`. */
  shot: (name: string, options?: { fullPage?: boolean }) => Promise<void>;
  /** Marks a chapter; its title and time offset go into the manifest. */
  step: (title: string) => void;
};
export type Scenario = (context: ScenarioContext) => Promise<void>;

const CURSOR_ID = "__shots_cursor";

// Runs in the page. Headless Chromium draws no pointer, so a recording would
// show buttons pressing themselves; this draws one from the mouse events.
function cursor(id: string) {
  if (window !== window.top) return;
  const dot = document.createElement("div");
  dot.id = id;
  dot.style.cssText =
    "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:22px;height:22px;" +
    "margin:-11px 0 0 -11px;border-radius:50%;background:rgba(20,20,20,.55);border:2px solid #fff;" +
    "box-shadow:0 0 0 1px rgba(0,0,0,.35);transition:transform .2s cubic-bezier(.2,.8,.2,1)";
  // Hidden until the mouse first moves, else half a pointer sits in the corner.
  dot.style.display = "none";
  const place = (x: number, y: number) => {
    dot.style.display = "";
    dot.style.transform = `translate(${x}px,${y}px)`;
  };
  // The position survives a navigation, else the pointer jumps to the corner on every page.
  const saved = /^(\d+),(\d+)$/.exec(sessionStorage.getItem(id) ?? "");
  if (saved) place(Number(saved[1]), Number(saved[2]));
  addEventListener(
    "mousemove",
    (e) => {
      place(e.clientX, e.clientY);
      sessionStorage.setItem(id, `${Math.round(e.clientX)},${Math.round(e.clientY)}`);
    },
    true,
  );
  addEventListener(
    "mousedown",
    (e) => {
      const ring = document.createElement("div");
      ring.style.cssText =
        `position:fixed;left:${e.clientX - 11}px;top:${e.clientY - 11}px;z-index:2147483647;` +
        "pointer-events:none;width:22px;height:22px;border-radius:50%;border:2px solid #fff;" +
        "box-shadow:0 0 0 1px rgba(0,0,0,.35)";
      document.documentElement.append(ring);
      ring.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(3)", opacity: 0 }], {
        duration: 450,
        easing: "ease-out",
      }).onfinish = () => ring.remove();
    },
    true,
  );
  const attach = () => document.documentElement.append(dot);
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", attach);
  else attach();
}

/**
 * Records `page` into `path` as H.264 at the device's pixels. Chromium's
 * screencast hands over a JPEG whenever the page repaints; each goes down a
 * pipe to ffmpeg, repeated as often as the wall clock says, so the frame rate
 * is constant and an offset in the video is an offset in the run. Playwright's
 * own `recordVideo` is the same screencast squeezed into low-bitrate VP8 at CSS
 * size, which is why it is not used.
 *
 * ponytail: one page. A popup or a second tab is not in the video; record each
 * page's session when a scenario needs that.
 */
type Recorded = { captured: number; written: number; backlog: number; seconds: number };

async function record(context: BrowserContext, page: Page, path: string) {
  const encoder = spawn("ffmpeg", ["-v", "error", ...recordArgs(path)], { stdio: ["pipe", "ignore", "pipe"] });
  const closed = once(encoder, "close");
  let complaint = "";
  encoder.stderr.on("data", (chunk) => (complaint += chunk));
  // A dead encoder is reported by its exit code, not by the pipe.
  encoder.stdin.on("error", () => {});

  const cdp = await context.newCDPSession(page);
  const start = Date.now();
  let frame: Buffer | undefined;
  const stats = { captured: 0, written: 0, backlog: 0 };
  let ended = false;
  const fill = (elapsed: number) => {
    // A repaint can still arrive after the stop; writing it would destroy the
    // pipe and take the frames queued in it along.
    if (!frame || ended) return;
    for (let n = framesDue(elapsed, stats.written); n > 0; n--, stats.written++) encoder.stdin.write(frame);
    stats.backlog = Math.max(stats.backlog, encoder.stdin.writableLength);
  };
  cdp.on("Page.screencastFrame", (event) => {
    // Chromium sends the next frame only after this one is acknowledged.
    cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
    fill(Date.now() - start);
    frame = Buffer.from(event.data, "base64");
    stats.captured++;
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92 });

  return {
    start,
    /** Ends the file. Call it before the context closes. */
    async stop(): Promise<Recorded> {
      await cdp.send("Page.stopScreencast").catch(() => {});
      const seconds = (Date.now() - start) / 1000;
      fill(seconds * 1000);
      if (frame && !stats.written) {
        encoder.stdin.write(frame);
        stats.written = 1;
      }
      ended = true;
      encoder.stdin.end();
      const [code] = (await closed) as [number | null];
      if (!frame) throw new Error("the page never painted, so there is no video");
      if (code !== 0) throw new Error(`ffmpeg failed: ${complaint.trim()}`);
      // A frame the encoder lost shortens the video and shifts every caption after it.
      const kept = Math.round((measure(path, "video.mp4").duration ?? 0) * FPS);
      if (Math.abs(kept - stats.written) > 1)
        throw new Error(`the encoder kept ${kept} of the ${stats.written} frames it was sent`);
      return { ...stats, seconds };
    },
  };
}

/** Size, dimensions and duration of a file, through ffprobe. */
export function measure(path: string, name: string): RunFile {
  const type = contentType(name);
  const file: RunFile = { name, contentType: type, bytes: statSync(path).size };
  if (!/^(image|video)\//.test(type)) return file;
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", path],
      { encoding: "utf8" },
    ),
  ) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
  file.width = probe.streams?.[0]?.width;
  file.height = probe.streams?.[0]?.height;
  const duration = Number(probe.format?.duration);
  if (type !== "image/png" && Number.isFinite(duration)) file.duration = Math.round(duration * 100) / 100;
  return file;
}

/** Adds or replaces a file's entry in the `run.json` of `dir`, when there is one. */
export function recordFile(dir: string, name: string): boolean {
  const path = join(dir, "run.json");
  let run: Run;
  try {
    run = JSON.parse(readFileSync(path, "utf8")) as Run;
  } catch {
    return false;
  }
  run.files = [...run.files.filter((f) => f.name !== name), measure(join(dir, name), name)];
  writeFileSync(path, `${JSON.stringify(run, null, 2)}\n`);
  return true;
}

function git(): Run["git"] {
  const ask = (...args: string[]) =>
    execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    const commit = ask("rev-parse", "HEAD");
    let remote: string | undefined;
    try {
      remote = ask("remote", "get-url", "origin");
    } catch {}
    return { commit, branch: ask("rev-parse", "--abbrev-ref", "HEAD"), remote };
  } catch {
    return undefined;
  }
}

// The peak of the systemd scope `heavy` put this process in, browser included.
function peakMemory(): number | undefined {
  try {
    const group = readFileSync("/proc/self/cgroup", "utf8").trim().replace(/^0::/, "");
    return Math.round(Number(readFileSync(`/sys/fs/cgroup${group}/memory.peak`, "utf8")) / 2 ** 20);
  } catch {
    return undefined;
  }
}

export async function run(o: RunOptions): Promise<void> {
  const loaded = (await import(pathToFileURL(resolve(o.scenario)).href)) as { default?: Scenario };
  if (typeof loaded.default !== "function")
    throw new Error(`${o.scenario} has no default export: export default async ({ page, base, shot, step }) => {}`);

  const createdAt = new Date();
  const id = runId(createdAt, o.scenario);
  const out = resolve(o.out ?? join("out", id));
  mkdirSync(out, { recursive: true });

  const { width, height, scale } = o.viewport;
  const browser = await chromium.launch({
    slowMo: o.slow,
    // The context's deviceScaleFactor alone gives sharp shots but a screencast
    // in CSS pixels. Scaling the browser itself makes the frames device-sized.
    args: scale === 1 ? [] : [`--force-device-scale-factor=${scale}`],
  });
  const steps: Step[] = [];
  const shots: { name: string; at: number }[] = [];
  let video: Recorded | undefined;
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      // Touch and the mobile viewport: what sites key their phone layout on.
      isMobile: o.mobile,
      hasTouch: o.mobile,
      locale: o.locale,
      colorScheme: o.dark ? "dark" : "light",
      storageState: o.storageState,
    });
    if (o.cursor) await context.addInitScript(cursor, CURSOR_ID);
    const page = await context.newPage();
    const recording = o.video ? await record(context, page, join(out, "video.mp4")) : undefined;
    const start = recording?.start ?? Date.now();
    const shot: ScenarioContext["shot"] = async (name, options) => {
      const file = `${String(shots.length + 1).padStart(2, "0")}-${slug(name) || "shot"}.png`;
      await page.screenshot({
        path: join(out, file),
        fullPage: options?.fullPage,
        style: `#${CURSOR_ID}{display:none}`,
      });
      shots.push({ name: file, at: Date.now() - start });
    };
    try {
      await loaded.default({
        page,
        base: o.base,
        shot,
        step: (title) => void steps.push({ title, at: Date.now() - start }),
      });
    } catch (error) {
      await page.screenshot({ path: join(out, "failed.png") }).catch(() => {});
      console.error(`shots: the scenario failed, the page as it was is ${join(out, "failed.png")}`);
      throw error;
    } finally {
      try {
        video = await recording?.stop();
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const files: RunFile[] = shots.map((s) => ({ ...measure(join(out, s.name), s.name), at: s.at }));
  if (video) files.push(measure(join(out, "video.mp4"), "video.mp4"));

  const result: Run = {
    id,
    scenario: o.scenario,
    base: o.base,
    viewport: o.viewport,
    mobile: o.mobile || undefined,
    preset: o.preset,
    locale: o.locale,
    dark: o.dark,
    steps,
    files,
    git: git(),
    createdAt: createdAt.toISOString(),
  };
  writeFileSync(join(out, "run.json"), `${JSON.stringify(result, null, 2)}\n`);

  for (const f of files) {
    const size = f.width ? ` ${f.width}x${f.height}` : "";
    const length = f.duration === undefined ? "" : ` ${f.duration}s`;
    console.log(`${join(out, f.name)}  ${(f.bytes / 1024).toFixed(0)} KB${size}${length}`);
  }
  console.log(join(out, "run.json"));
  if (video)
    console.error(
      `shots: video ${FPS} fps, ${video.written} frames over ${video.seconds.toFixed(2)}s from ${video.captured} repaints, ` +
        `encoder backlog at most ${(video.backlog / 2 ** 20).toFixed(1)} MB`,
    );
  const peak = process.env.SHOTS_HEAVY ? peakMemory() : undefined;
  if (peak) console.error(`shots: peak memory ${peak} MB of the 1500 MB cap`);
}
