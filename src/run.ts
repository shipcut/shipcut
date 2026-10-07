// `shots run`: drive a scenario in headless Chromium, keep the shots and the video.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type BrowserContext, chromium, type Page } from "playwright";
import { concatList, contentType, FPS, frameName, recordArgs, runId, type RunOptions, slug } from "./lib.ts";
import type { Run, RunFile, Step } from "./types.ts";

/** What a scenario's default export receives. */
export type ScenarioContext = {
  page: Page;
  /** `--base` without a trailing slash. */
  base: string;
  /** Saves `NN-name.png` of the viewport, or of the whole page with `fullPage`. */
  shot: (name: string, options?: { fullPage?: boolean }) => Promise<void>;
  /** Marks a chapter; its title and time offset go into the manifest, and `shots caption` burns it in unless `caption: false`. */
  step: (title: string, options?: { caption?: false }) => void;
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
 * Records `page` into `<out>/video.mp4` at the device's pixels. Chromium's
 * screencast hands over a JPEG whenever the page repaints; each is written to
 * `<out>/.frames/` with its offset, and nothing else runs while the page does.
 * `encode()`, after the browser has closed, turns the frames into H.264, each
 * shown until the next arrived, so the frame rate is constant and an offset in
 * the video is an offset in the run. Playwright's own `recordVideo` is the same
 * screencast squeezed into low-bitrate VP8 at CSS size, which is why it is not
 * used.
 *
 * A minute of motion is a few hundred MB of JPEGs until the encode ends. The
 * folder goes when it succeeds and stays, named in the error, when it fails.
 *
 * ponytail: one page. A popup or a second tab is not in the video; record each
 * page's session when a scenario needs that.
 */
type Recorded = { captured: number; seconds: number; encodeSeconds: number };

async function record(context: BrowserContext, page: Page, out: string) {
  const frames = join(out, ".frames");
  mkdirSync(frames, { recursive: true });
  const cdp = await context.newCDPSession(page);
  const start = Date.now();
  const offsets: number[] = [];
  let seconds = 0;
  cdp.on("Page.screencastFrame", (event) => {
    // Chromium sends the next frame only after this one is acknowledged.
    cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
    if (seconds) return; // a repaint after the stop is not in the recording
    writeFileSync(join(frames, frameName(offsets.length)), Buffer.from(event.data, "base64"));
    offsets.push(Date.now() - start);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92 });

  return {
    start,
    /** Ends the capture and writes the list. Call it before the context closes. */
    async stop(): Promise<void> {
      await cdp.send("Page.stopScreencast").catch(() => {});
      seconds = (Date.now() - start) / 1000;
      if (!offsets.length) throw new Error("the page never painted, so there is no video");
      writeFileSync(join(frames, "list.ffconcat"), concatList(offsets, seconds * 1000));
    },
    /** Encodes the frames into the video. Call it after the browser has closed. */
    encode(): Recorded {
      const began = Date.now();
      const path = join(out, "video.mp4");
      const done = spawnSync("ffmpeg", ["-v", "error", ...recordArgs(join(frames, "list.ffconcat"), path, seconds)], {
        stdio: ["ignore", "ignore", "pipe"],
      });
      if (done.error) throw done.error;
      if (done.status !== 0) throw new Error(`ffmpeg failed: ${done.stderr.toString().trim()}; the frames are in ${frames}`);
      // A frame the encoder lost shortens the video and shifts every step after it.
      const duration = measure(path, "video.mp4").duration ?? 0;
      if (Math.abs(duration - seconds) > 1 / FPS)
        throw new Error(`the video is ${duration}s for a ${seconds.toFixed(2)}s recording; the frames are in ${frames}`);
      rmSync(frames, { recursive: true, force: true });
      return { captured: offsets.length, seconds, encodeSeconds: (Date.now() - began) / 1000 };
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
  let recording: Awaited<ReturnType<typeof record>> | undefined;
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
    recording = o.video ? await record(context, page, out) : undefined;
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
        step: (title, options) =>
          void steps.push({ title, at: Date.now() - start, ...(options?.caption === false ? { caption: false } : {}) }),
      });
    } catch (error) {
      await page.screenshot({ path: join(out, "failed.png") }).catch(() => {});
      console.error(`shots: the scenario failed, the page as it was is ${join(out, "failed.png")}`);
      if (recording) console.error(`shots: the frames captured so far are in ${join(out, ".frames")}`);
      throw error;
    } finally {
      try {
        await recording?.stop();
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  // The encode runs alone, after Chromium has given the cores back.
  video = recording?.encode();

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
    recording: video ? { seconds: Math.round(video.seconds * 100) / 100, repaints: video.captured } : undefined,
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
      `shots: video ${FPS} fps, ${video.seconds.toFixed(2)}s from ${video.captured} repaints ` +
        `(${(video.captured / video.seconds).toFixed(1)}/s), encoded in ${video.encodeSeconds.toFixed(1)}s`,
    );
  const peak = process.env.SHOTS_HEAVY ? peakMemory() : undefined;
  if (peak) console.error(`shots: peak memory ${peak} MB of the 1500 MB cap`);
}
