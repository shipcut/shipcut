// `shots clip`: trim, speed up, scale or GIF a video. ffmpeg does the work.
import { spawnSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { clipArgs, type ClipOptions } from "./lib.ts";
import { measure, recordFile } from "./run.ts";

export function clip(o: ClipOptions): void {
  const done = spawnSync("ffmpeg", ["-v", "error", ...clipArgs(o)], { stdio: ["ignore", "ignore", "pipe"] });
  if (done.error) throw done.error;
  if (done.status !== 0) throw new Error(`ffmpeg failed: ${done.stderr.toString().trim()}`);

  const out = resolve(o.out);
  const f = measure(out, basename(out));
  console.log(`${o.out}  ${(f.bytes / 1024).toFixed(0)} KB ${f.width}x${f.height} ${f.duration}s`);
  if (recordFile(dirname(out), basename(out))) console.log("added to run.json");
}
