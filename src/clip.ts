// `shots clip`, `caption`, `polish` and `measure`: ffmpeg does the work.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import {
  BT709,
  type CaptionOptions,
  captionFilter,
  captionTimeline,
  clipArgs,
  type ClipOptions,
  FPS,
  framesKept,
  MP4,
  measureLines,
  pointerSprite,
  pointerTrack,
  type PolishOptions,
  ringFrames,
} from "./lib.ts";
import { measure, recordFile, reportPeak } from "./run.ts";
import type { Run } from "./types.ts";

/** Runs ffmpeg (in `cwd` when given), reports the result, and adds it to a `run.json` beside it. */
function produce(args: string[], path: string, cwd?: string): void {
  const done = spawnSync("ffmpeg", ["-v", "error", ...args], { cwd, stdio: ["ignore", "ignore", "pipe"] });
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

/** The bold sans fontconfig would pick, or nothing where there is no fontconfig. */
function systemFont(): { file: string; name: string } | undefined {
  try {
    const [file, name] = execFileSync("fc-match", ["-f", "%{file}\n%{fullname}", "sans-serif:bold"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).split("\n");
    return file ? { file, name: name || basename(file) } : undefined;
  } catch {
    return undefined;
  }
}

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

  const font = o.font ? { file: o.font, name: o.font } : systemFont();
  console.error(
    font ? `shots: captions in ${font.name} (${font.file})` : "shots: no fc-match here, captions in ffmpeg's default font",
  );
  const filter = captionFilter(captions, { width: video.width, height: video.height }, font?.file);
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
 * Draws the pointer `run --pointer` logged over the run's video: the sprite
 * moved frame by frame through `sendcmd`, and a ring for each press, each one
 * the same sequence of SVG frames shifted to its moment. The sprites are SVG
 * rendered by ffmpeg's librsvg at the run's scale, so they are as sharp as the
 * page under them.
 *
 * ponytail: one ffmpeg input per press, fine for tens of clicks. A run with
 * hundreds wants one ring track built like the pointer's.
 */
export function polish(o: PolishOptions): void {
  const run = JSON.parse(readFileSync(join(o.dir, "run.json"), "utf8")) as Run;
  const source = resolve(o.dir, "video.mp4");
  const video = run.files.find((f) => f.name === "video.mp4");
  if (!video?.duration) throw new Error(`${o.dir} has no video.mp4: record with \`shots run --video --pointer\``);
  if (!run.events?.moves.length) throw new Error(`${o.dir} has no pointer to draw: record with \`shots run --video --pointer\``);
  if (resolve(o.out) === source) throw new Error("--out is the source video");

  const scale = run.viewport.scale;
  const px = (css: number) => String(Math.round(css * scale));
  const sprite = pointerSprite(Boolean(run.mobile));
  const track = pointerTrack(run.events.moves, video.duration, scale, sprite.hotspot)!;
  const rings = ringFrames();
  const ring = rings[0]!;

  const work = mkdtempSync(join(tmpdir(), "shots-polish-"));
  try {
    writeFileSync(join(work, "pointer.svg"), sprite.svg);
    writeFileSync(join(work, "pointer.cmd"), track.commands);
    rings.forEach((r, k) => writeFileSync(join(work, `ring${String(k).padStart(2, "0")}.svg`), r.svg));

    const fps = String(FPS);
    const args = ["-y", "-i", source];
    args.push("-loop", "1", "-framerate", fps, "-t", String(video.duration), "-width", px(sprite.width), "-i", "pointer.svg");
    const graph: string[] = [];
    let below = "0:v";
    run.events.clicks.forEach(([at, x, y], k) => {
      args.push("-itsoffset", (at / 1000).toFixed(3), "-framerate", fps, "-width", px(ring.width), "-i", "ring%02d.svg");
      graph.push(`[${below}][${k + 2}:v]overlay=x=${px(x - ring.hotspot.x)}:y=${px(y - ring.hotspot.y)}:eof_action=pass[r${k}]`);
      below = `r${k}`;
    });
    graph.push(
      `[${below}]sendcmd=f=pointer.cmd[moved]`,
      `[moved][1:v]overlay@pointer=x=${track.start.x}:y=${track.start.y}:enable='gte(t,${track.from})':eof_action=pass[out]`,
    );
    produce(
      [...args, "-filter_complex", graph.join(";"), "-map", "[out]", ...MP4, ...BT709, "-preset", "medium", resolve(o.out)],
      o.out,
      work,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  reportPeak();
}
