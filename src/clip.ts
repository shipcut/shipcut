// `shots clip`, `shots caption` and `shots measure`: ffmpeg does the work.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { type CaptionOptions, captionFilter, captionTimeline, clipArgs, type ClipOptions, framesKept, MP4, measureLines } from "./lib.ts";
import { measure, recordFile } from "./run.ts";
import type { Run } from "./types.ts";

/** Runs ffmpeg, reports the result, and adds it to a `run.json` beside it. */
function produce(args: string[], path: string): void {
  const done = spawnSync("ffmpeg", ["-v", "error", ...args], { stdio: ["ignore", "ignore", "pipe"] });
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
