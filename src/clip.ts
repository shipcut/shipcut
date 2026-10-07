// `shots clip`, `caption`, `polish` and `measure`: ffmpeg does the work.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BT709,
  backgroundSvg,
  type CaptionOptions,
  captionFilter,
  captionTimeline,
  clipArgs,
  type ClipOptions,
  follow,
  frameLayout,
  FPS,
  framesKept,
  LABEL,
  labelPlace,
  labelProbe,
  labelSprite,
  labelWindows,
  MP4,
  measureLines,
  POINTER,
  PRESS_FRAMES,
  pointerTrack,
  polishPlan,
  type PolishOptions,
  clickFrames,
  STORY_SAFE,
  windowMask,
  zoomFilter,
  zoomTrack,
} from "./lib.ts";
import { measure, recordFile, reportPeak } from "./run.ts";
import type { Run } from "./types.ts";

/** Runs ffmpeg (in `cwd`, with `env`, when given), reports the result, and adds it to a `run.json` beside it. */
function produce(args: string[], path: string, cwd?: string, env?: NodeJS.ProcessEnv): void {
  const done = spawnSync("ffmpeg", ["-v", "error", ...args], { cwd, env, stdio: ["ignore", "ignore", "pipe"] });
  if (done.error) throw done.error;
  if (done.status !== 0) throw new Error(`ffmpeg failed: ${done.stderr.toString().trim()}`);

  const out = resolve(path);
  const f = measure(out, basename(out));
  console.log(`${path}  ${(f.bytes / 1024).toFixed(0)} KB ${f.width}x${f.height} ${f.duration}s`);
  if (recordFile(dirname(out), basename(out))) console.log("added to run.json");
}

export function clip(o: ClipOptions): void {
  produce(clipArgs(o), o.out);
}

/** The captions' face unless `--font`: Inter Bold, shipped in `fonts/` like the labels' SemiBold. */
const CAPTION_FONT = fileURLToPath(new URL("../fonts/Inter-Bold.ttf", import.meta.url));

/** Burns each step's title into the run's video, from its offset to the next step's. */
export function caption(o: CaptionOptions): void {
  const run = JSON.parse(readFileSync(join(o.dir, "run.json"), "utf8")) as Run;
  const source = join(o.dir, "video.mp4");
  const video = run.files.find((f) => f.name === "video.mp4");
  if (!video?.width || !video.height || !video.duration)
    throw new Error(`${o.dir} has no video.mp4: record with \`shots run --video\``);
  if (resolve(o.out) === resolve(source)) throw new Error("--out is the source video");

  const captions = captionTimeline(run.steps, video.duration);
  if (!captions.length) throw new Error("no step to caption: the scenario marks them with step(title)");

  const font = o.font ?? CAPTION_FONT;
  console.error(`shots: captions in ${o.font ?? "Inter Bold"}`);
  const filter = captionFilter(captions, { width: video.width, height: video.height }, font);
  produce(["-y", "-i", source, "-vf", filter, ...MP4, o.out], o.out);
}

/** Prints how a run's video came out: distinct frames a second and its length against the recording. */
export function measureRun(dir: string): void {
  const run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) as Run;
  const video = measure(join(dir, "video.mp4"), "video.mp4");
  if (!video.duration) throw new Error(`${dir} has no video.mp4: record with \`shots run --video\``);
  // mpdecimate drops a frame that differs from the one before it by almost nothing,
  // so what reaches the null output is the count of distinct pictures.
  const done = spawnSync("ffmpeg", ["-v", "error", "-stats", "-i", join(dir, "video.mp4"), "-vf", "mpdecimate", "-an", "-f", "null", "-"], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (done.error) throw done.error;
  if (done.status !== 0) throw new Error(`ffmpeg failed: ${done.stderr.toString().trim()}`);
  for (const line of measureLines(run, video.duration, framesKept(done.stderr.toString()))) console.log(line);
}

/**
 * Draws the pointer `run --pointer` logged over the run's video: the arrow
 * moved frame by frame through `sendcmd`, and for each press the same
 * sequence of SVG frames shifted to its moment, a wave with the arrow giving
 * under the finger, while the pointer's own overlay steps aside. The sprites are SVG
 * rendered by ffmpeg's librsvg at the run's scale, so they are as sharp as the
 * page under them. With `zoom`, the camera then closes in on the clicks; the
 * pointer is drawn first, so it grows with the page. With `frame`, the result
 * shrinks into a rounded window with a shadow on a still background, so the
 * camera moves inside the window.
 *
 * ponytail: one ffmpeg input per press, fine for tens of clicks. A run with
 * hundreds wants one press track built like the pointer's.
 */
export function polish(o: PolishOptions): void {
  const run = JSON.parse(readFileSync(join(o.dir, "run.json"), "utf8")) as Run;
  const source = resolve(o.dir, "video.mp4");
  const video = run.files.find((f) => f.name === "video.mp4");
  if (!video?.duration) throw new Error(`${o.dir} has no video.mp4: record with \`shots run --video --pointer\``);
  if (!run.events?.moves.length) throw new Error(`${o.dir} has no pointer to draw: record with \`shots run --video --pointer\``);
  if (resolve(o.out) === source) throw new Error("--out is the source video");

  const plan = polishPlan(o, { width: video.width!, height: video.height! }, run.preset);
  const scale = run.viewport.scale;
  const px = (css: number) => String(Math.round(css * scale));
  const sprite = POINTER;
  const track = pointerTrack(run.events.moves, video.duration, scale, sprite.hotspot)!;
  const presses = clickFrames();
  const press = presses[0]!;

  const work = mkdtempSync(join(tmpdir(), "shots-polish-"));
  const env = { ...process.env, FONTCONFIG_FILE: fontConfig(work) };
  try {
    writeFileSync(join(work, "pointer.svg"), sprite.svg);
    presses.forEach((p, k) => writeFileSync(join(work, `press${String(k).padStart(2, "0")}.svg`), p.svg));

    const fps = String(FPS);
    const args = ["-y", "-i", source];
    let inputs = 1;
    // A still is decoded once and repeated by the loop filter: an input looped
    // with -loop 1 has librsvg draw it again for every frame, which for a
    // background with a blurred shadow cost two minutes on a 17 s video.
    const frames = Math.round(video.duration * FPS);
    const still = (file: string, width?: string) => {
      // At 30 like the video: the background leads the last overlay, and its rate becomes the output's.
      args.push("-framerate", fps, ...(width ? ["-width", width] : []), "-i", file);
      // loop counts repeats after the first frame, so the still has as many frames as the video.
      return `[${inputs++}:v]loop=loop=${frames - 1}:size=1:start=0,setpts=N/${FPS}/TB`;
    };
    const pointerStill = still("pointer.svg", px(sprite.width));
    const commands = [...track.commands];
    // One sendcmd at the head of the chain moves every overlay that follows the pointer.
    const graph = ["[0:v]sendcmd=f=moves.cmd[timed]"];
    let below = "timed";
    run.events.clicks.forEach(([at, x, y], k) => {
      args.push("-itsoffset", (at / 1000).toFixed(3), "-framerate", fps, "-width", px(press.width), "-i", "press%02d.svg");
      graph.push(`[${below}][${inputs++}:v]overlay=x=${px(x - press.hotspot.x)}:y=${px(y - press.hotspot.y)}:eof_action=pass[r${k}]`);
      below = `r${k}`;
    });
    if (plan.labels) {
      const frame = { width: video.width! / scale, height: video.height! / scale };
      const safe = run.preset === "story" ? { top: STORY_SAFE.top / scale, bottom: STORY_SAFE.bottom / scale } : undefined;
      const windows = labelWindows(run.steps, video.duration, track.from);
      console.error(`shots: ${windows.length} labels in ${labelFont(env)}`);
      windows.forEach(({ text, from, to }, k) => {
        const label = labelSprite(text, measureInk(text, scale, join(work, `probe${k}.svg`), env));
        writeFileSync(join(work, `label${k}.svg`), label.svg);
        const labelStill = still(`label${k}.svg`, px(label.width));
        const place = (x: number, y: number) => {
          const at = labelPlace({ x, y }, label.pill, frame, safe);
          return { x: Math.round((at.x - label.hotspot.x) * scale), y: Math.round((at.y - label.hotspot.y) * scale) };
        };
        commands.push(...follow(run.events!.moves, `overlay@label${k}`, from, to, place));
        const fade = LABEL.fade;
        graph.push(
          `${labelStill},format=rgba,fade=t=in:st=${from}:d=${fade}:alpha=1,fade=t=out:st=${(to - fade).toFixed(3)}:d=${fade}:alpha=1[label${k}]`,
          `[${below}][label${k}]overlay@label${k}=x=-9999:y=-9999:enable='between(t,${from},${to})':eof_action=pass[l${k}]`,
        );
        below = `l${k}`;
      });
    }
    writeFileSync(join(work, "moves.cmd"), `${commands.join("\n")}\n`);
    // The pointer steps aside while a press sprite draws the arrow for it.
    const pressing = run.events.clicks.map(([at]) => `-gte(t,${at / 1000})*lt(t,${(at / 1000 + PRESS_FRAMES / FPS).toFixed(4)})`).join("");
    graph.push(
      `${pointerStill}[arrow]`,
      `[${below}][arrow]overlay@pointer=x=${track.start.x}:y=${track.start.y}:enable='gte(t,${track.from})*gt(1${pressing},0)':eof_action=pass[drawn]`,
    );
    const size = { width: video.width!, height: video.height!, scale, seconds: video.duration };
    const camera = plan.zoom ? zoomTrack(run.events.clicks, run.steps, size, plan.zoom) : undefined;
    graph.push(camera?.keys.length ? `[drawn]${zoomFilter(camera.keys, size)}[shot]` : "[drawn]null[shot]");
    if (plan.frame) {
      const window = frameLayout(size);
      writeFileSync(join(work, "background.svg"), backgroundSvg(size, window, plan.frame));
      writeFileSync(join(work, "mask.svg"), windowMask(window));
      graph.push(
        `${still("background.svg")}[background]`,
        `${still("mask.svg")},format=gray[mask]`,
        `[shot]scale=${window.width}:${window.height}:flags=lanczos,format=yuva420p[inner]`,
        "[inner][mask]alphamerge[window]",
        `[background][window]overlay=x=${window.x}:y=${window.y}:shortest=1[out]`,
      );
      console.error(`shots: framed at ${window.width}x${window.height} in ${size.width}x${size.height}, background ${plan.frame.join(" to ")}`);
    } else graph.push("[shot]null[out]");
    if (camera) console.error(`shots: ${camera.spans.length} zooms at ${plan.zoom}x, ${camera.spans.map(([a, b]) => `${a}-${b}s`).join(", ") || "no click to zoom on"}`);
    // The zoom's expressions run to tens of kilobytes, so the graph goes in a file.
    writeFileSync(join(work, "graph.txt"), graph.join(";\n"));
    produce(
      [...args, "-filter_complex_script", "graph.txt", "-map", "[out]", ...MP4, ...BT709, "-preset", "medium", resolve(o.out)],
      o.out,
      work,
      env,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  reportPeak();
}

/** The ink of a label's text in CSS pixels, found by rendering it with ffmpeg's librsvg and reading the `bbox` filter. */
function measureInk(text: string, scale: number, file: string, env: NodeJS.ProcessEnv): { left: number; width: number } {
  const probe = labelProbe(text);
  writeFileSync(file, probe.svg);
  const width = String(Math.round(probe.width * scale));
  const done = spawnSync("ffmpeg", ["-v", "info", "-width", width, "-i", file, "-vf", "bbox=min_val=64", "-frames:v", "1", "-f", "null", "-"], {
    encoding: "utf8",
    env,
  });
  const box = /x1:(\d+) x2:(\d+)/.exec(done.stderr);
  if (!box) throw new Error(`could not measure the label "${text}": ${done.stderr.trim().split("\n").at(-1)}`);
  return { left: Number(box[1]) / scale - LABEL.padX, width: (Number(box[2]) - Number(box[1]) + 1) / scale };
}

/**
 * A fontconfig file that adds the package's own `fonts/` to the system's, so
 * librsvg sets the labels in the bundled Inter on any machine, and still
 * finds the system's fonts for a glyph Inter lacks.
 */
function fontConfig(work: string): string {
  const fonts = fileURLToPath(new URL("../fonts/", import.meta.url));
  const file = join(work, "fonts.conf");
  writeFileSync(
    file,
    `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>\n` +
      `  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n  <dir>${fonts}</dir>\n</fontconfig>\n`,
  );
  return file;
}

/** The face fontconfig gives a label, named so a run says what it drew with. */
function labelFont(env: NodeJS.ProcessEnv): string {
  try {
    return (
      execFileSync("fc-match", ["-f", "%{fullname}", "Inter:weight=600"], { encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"] }) ||
      "the default font"
    );
  } catch {
    return "the default font";
  }
}
