import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BT709,
  backgroundSvg,
  type CaptionOptions,
  captionFilter,
  filterValue,
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
  type NarrateOptions,
  narrationPlan,
  narrationSegments,
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
import { setting } from "./store.ts";
import type { Run } from "./types.ts";

function ffmpeg(args: string[], cwd?: string, env?: NodeJS.ProcessEnv): void {
  const done = spawnSync("ffmpeg", ["-v", "error", ...args], {
    cwd,
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (done.error) throw done.error;
  if (done.status !== 0)
    throw new Error(`ffmpeg failed: ${done.stderr.toString().trim()}`);
}

function produce(
  args: string[],
  path: string,
  cwd?: string,
  env?: NodeJS.ProcessEnv
): void {
  ffmpeg(args, cwd, env);

  const out = resolve(path);
  const f = measure(out, basename(out));
  console.log(
    `${path}  ${(f.bytes / 1024).toFixed(0)} KB ${f.width}x${f.height} ${f.duration}s`
  );
  if (recordFile(dirname(out), basename(out))) console.log("added to run.json");
}

export function clip(o: ClipOptions): void {
  produce(clipArgs(o), o.out);
}

const CAPTION_FONT = fileURLToPath(
  new URL("../fonts/Inter-Bold.ttf", import.meta.url)
);

export function caption(o: CaptionOptions): void {
  const run = JSON.parse(readFileSync(join(o.dir, "run.json"), "utf-8")) as Run;
  const source = join(o.dir, "video.mp4");
  const video = run.files.find((f) => f.name === "video.mp4");
  if (!video?.width || !video.height || !video.duration)
    throw new Error(
      `${o.dir} has no video.mp4: record with \`shipcut run --video\``
    );
  if (resolve(o.out) === resolve(source))
    throw new Error("--out is the source video");

  const captions = captionTimeline(run.steps, video.duration);
  if (!captions.length)
    throw new Error(
      "no step to caption: the scenario marks them with step(title)"
    );

  const font = o.font ?? CAPTION_FONT;
  console.error(`shipcut: captions in ${o.font ?? "Inter Bold"}`);
  const filter = captionFilter(
    captions,
    { width: video.width, height: video.height },
    font
  );
  produce(["-y", "-i", source, "-vf", filter, ...MP4, o.out], o.out);
}

export function measureRun(dir: string): void {
  const run = JSON.parse(readFileSync(join(dir, "run.json"), "utf-8")) as Run;
  const video = measure(join(dir, "video.mp4"), "video.mp4");
  if (!video.duration)
    throw new Error(
      `${dir} has no video.mp4: record with \`shipcut run --video\``
    );
  // mpdecimate drops a frame that differs from the one before it by almost nothing,
  // so what reaches the null output is the count of distinct pictures.
  const done = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-stats",
      "-i",
      join(dir, "video.mp4"),
      "-vf",
      "mpdecimate",
      "-an",
      "-f",
      "null",
      "-",
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
    }
  );
  if (done.error) throw done.error;
  if (done.status !== 0)
    throw new Error(`ffmpeg failed: ${done.stderr.toString().trim()}`);
  for (const line of measureLines(
    run,
    video.duration,
    framesKept(done.stderr.toString())
  ))
    console.log(line);
}

/**
 * The sprites are SVG rendered by ffmpeg's librsvg at the run's scale, so they
 * are as sharp as the page under them. With `zoom`, the pointer is drawn first,
 * so it grows with the page.
 *
 * ponytail: one ffmpeg input per press, fine for tens of clicks. A run with
 * hundreds wants one press track built like the pointer's.
 */
export function polish(o: PolishOptions): void {
  const run = JSON.parse(readFileSync(join(o.dir, "run.json"), "utf-8")) as Run;
  const source = resolve(o.dir, "video.mp4");
  const video = run.files.find((f) => f.name === "video.mp4");
  if (!video?.duration)
    throw new Error(
      `${o.dir} has no video.mp4: record with \`shipcut run --video --pointer\``
    );
  if (!run.events?.moves.length)
    throw new Error(
      `${o.dir} has no pointer to draw: record with \`shipcut run --video --pointer\``
    );
  if (resolve(o.out) === source) throw new Error("--out is the source video");

  const plan = polishPlan(
    o,
    { width: video.width!, height: video.height! },
    run.preset
  );
  const { scale } = run.viewport;
  const px = (css: number) => String(Math.round(css * scale));
  const sprite = POINTER;
  const track = pointerTrack(
    run.events.moves,
    video.duration,
    scale,
    sprite.hotspot
  )!;
  const presses = clickFrames();
  const press = presses[0]!;

  const work = mkdtempSync(join(tmpdir(), "shipcut-polish-"));
  const env = {
    ...process.env,
    FONTCONFIG_FILE: fontConfig(work, o.labelFont),
  };
  const family = o.labelFont ? fontFamily(o.labelFont) : "Inter";
  try {
    writeFileSync(join(work, "pointer.svg"), sprite.svg);
    presses.forEach((p, k) =>
      writeFileSync(join(work, `press${String(k).padStart(2, "0")}.svg`), p.svg)
    );

    const fps = String(FPS);
    const args = ["-y", "-i", source];
    let inputs = 1;
    // A still is decoded once and repeated by the loop filter: an input looped
    // with -loop 1 has librsvg draw it again for every frame, which for a
    // background with a blurred shadow cost two minutes on a 17 s video.
    const frames = Math.round(video.duration * FPS);
    const still = (file: string, width?: string) => {
      // At 30 like the video: the background leads the last overlay, and its rate becomes the output's.
      args.push(
        "-framerate",
        fps,
        ...(width ? ["-width", width] : []),
        "-i",
        file
      );
      // loop counts repeats after the first frame, so the still has as many frames as the video.
      return `[${inputs++}:v]loop=loop=${frames - 1}:size=1:start=0,setpts=N/${FPS}/TB`;
    };
    const pointerStill = still("pointer.svg", px(sprite.width));
    const commands = [...track.commands];
    const graph = ["[0:v]sendcmd=f=moves.cmd[timed]"];
    let below = "timed";
    run.events.clicks.forEach(([at, x, y], k) => {
      args.push(
        "-itsoffset",
        (at / 1000).toFixed(3),
        "-framerate",
        fps,
        "-width",
        px(press.width),
        "-i",
        "press%02d.svg"
      );
      graph.push(
        `[${below}][${inputs++}:v]overlay=x=${px(x - press.hotspot.x)}:y=${px(y - press.hotspot.y)}:eof_action=pass[r${k}]`
      );
      below = `r${k}`;
    });
    if (plan.labels) {
      const frame = {
        width: video.width! / scale,
        height: video.height! / scale,
      };
      const safe =
        run.preset === "story"
          ? { top: STORY_SAFE.top / scale, bottom: STORY_SAFE.bottom / scale }
          : undefined;
      const windows = labelWindows(run.steps, video.duration, track.from);
      console.error(
        `shipcut: ${windows.length} labels in ${labelFont(env, family)}`
      );
      windows.forEach(({ text, from, to }, k) => {
        const label = labelSprite(
          text,
          measureInk(text, scale, join(work, `probe${k}.svg`), env, family),
          family
        );
        writeFileSync(join(work, `label${k}.svg`), label.svg);
        const labelStill = still(`label${k}.svg`, px(label.width));
        const place = (x: number, y: number) => {
          const at = labelPlace({ x, y }, label.pill, frame, safe);
          return {
            x: Math.round((at.x - label.hotspot.x) * scale),
            y: Math.round((at.y - label.hotspot.y) * scale),
          };
        };
        commands.push(
          ...follow(run.events!.moves, `overlay@label${k}`, from, to, place)
        );
        const { fade } = LABEL;
        graph.push(
          `${labelStill},format=rgba,fade=t=in:st=${from}:d=${fade}:alpha=1,fade=t=out:st=${(to - fade).toFixed(3)}:d=${fade}:alpha=1[label${k}]`,
          `[${below}][label${k}]overlay@label${k}=x=-9999:y=-9999:enable='between(t,${from},${to})':eof_action=pass[l${k}]`
        );
        below = `l${k}`;
      });
    }
    writeFileSync(join(work, "moves.cmd"), `${commands.join("\n")}\n`);
    const pressing = run.events.clicks
      .map(
        ([at]) =>
          `-gte(t,${at / 1000})*lt(t,${(at / 1000 + PRESS_FRAMES / FPS).toFixed(4)})`
      )
      .join("");
    graph.push(
      `${pointerStill}[arrow]`,
      `[${below}][arrow]overlay@pointer=x=${track.start.x}:y=${track.start.y}:enable='gte(t,${track.from})*gt(1${pressing},0)':eof_action=pass[drawn]`
    );
    const size = {
      width: video.width!,
      height: video.height!,
      scale,
      seconds: video.duration,
    };
    const camera = plan.zoom
      ? zoomTrack(run.events.clicks, run.steps, size, plan.zoom)
      : undefined;
    graph.push(
      camera?.keys.length
        ? `[drawn]${zoomFilter(camera.keys, size)}[shot]`
        : "[drawn]null[shot]"
    );
    if (plan.frame) {
      const window = frameLayout(size);
      writeFileSync(
        join(work, "background.svg"),
        backgroundSvg(size, window, plan.frame)
      );
      writeFileSync(join(work, "mask.svg"), windowMask(window));
      graph.push(
        `${still("background.svg")}[background]`,
        `${still("mask.svg")},format=gray[mask]`,
        `[shot]scale=${window.width}:${window.height}:flags=lanczos,format=yuva420p[inner]`,
        "[inner][mask]alphamerge[window]",
        `[background][window]overlay=x=${window.x}:y=${window.y}:shortest=1[out]`
      );
      console.error(
        `shipcut: framed at ${window.width}x${window.height} in ${size.width}x${size.height}, background ${plan.frame.join(" to ")}`
      );
    } else graph.push("[shot]null[out]");
    if (camera)
      console.error(
        `shipcut: ${camera.spans.length} zooms at ${plan.zoom}x, ${camera.spans.map(([a, b]) => `${a}-${b}s`).join(", ") || "no click to zoom on"}`
      );
    // The zoom's expressions run to tens of kilobytes, so the graph goes in a file.
    writeFileSync(join(work, "graph.txt"), graph.join(";\n"));
    produce(
      [
        ...args,
        "-filter_complex_script",
        "graph.txt",
        "-map",
        "[out]",
        ...MP4,
        ...BT709,
        "-preset",
        "medium",
        resolve(o.out),
      ],
      o.out,
      work,
      env
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  reportPeak();
}

/** The ink of a label's text in CSS pixels. */
function measureInk(
  text: string,
  scale: number,
  file: string,
  env: NodeJS.ProcessEnv,
  family: string
): { left: number; width: number } {
  const probe = labelProbe(text, family);
  writeFileSync(file, probe.svg);
  const width = String(Math.round(probe.width * scale));
  const done = spawnSync(
    "ffmpeg",
    [
      "-v",
      "info",
      "-width",
      width,
      "-i",
      file,
      "-vf",
      "bbox=min_val=64",
      "-frames:v",
      "1",
      "-f",
      "null",
      "-",
    ],
    {
      encoding: "utf-8",
      env,
    }
  );
  const box = /x1:(\d+) x2:(\d+)/.exec(done.stderr);
  if (!box)
    throw new Error(
      `could not measure the label "${text}": ${done.stderr.trim().split("\n").at(-1)}`
    );
  return {
    left: Number(box[1]) / scale - LABEL.padX,
    width: (Number(box[2]) - Number(box[1]) + 1) / scale,
  };
}

/**
 * A fontconfig file that adds the package's own `fonts/` to the system's, so
 * librsvg sets the labels in the bundled Inter on any machine, and still
 * finds the system's fonts for a glyph Inter lacks. A `--label-font` adds its
 * own directory too.
 */
function fontConfig(work: string, labelFont?: string): string {
  const dirs = [fileURLToPath(new URL("../fonts/", import.meta.url))];
  if (labelFont) dirs.push(dirname(resolve(labelFont)));
  const file = join(work, "fonts.conf");
  writeFileSync(
    file,
    `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>\n` +
      `  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n${dirs.map((d) => `  <dir>${d}</dir>\n`).join("")}</fontconfig>\n`
  );
  return file;
}

function fontFamily(path: string): string {
  const done = spawnSync("fc-scan", ["--format", "%{family[0]}", path], {
    encoding: "utf-8",
  });
  const family = done.stdout?.trim();
  if (done.status !== 0 || !family)
    throw new Error(`--label-font: ${path} is not a font fontconfig reads`);
  return family;
}

function labelFont(env: NodeJS.ProcessEnv, family: string): string {
  try {
    return (
      // "semibold", not "weight=600": fontconfig's weights are not CSS's, and 600 reads as past bold.
      execFileSync("fc-match", ["-f", "%{fullname}", `${family}:semibold`], {
        encoding: "utf-8",
        env,
        stdio: ["ignore", "pipe", "ignore"],
      }) || "the default font"
    );
  } catch {
    return "the default font";
  }
}

const FONTS = fileURLToPath(new URL("../fonts/", import.meta.url));

/** Writes `text` spoken by `voice` to `path`, a WAV or, from ElevenLabs, an MP3; ffmpeg tells them apart by content. */
async function speak(
  voice: NarrateOptions["voice"],
  text: string,
  path: string
): Promise<void> {
  if (voice.engine === "piper") {
    const done = spawnSync(
      "piper",
      ["--model", voice.name, "--output_file", path],
      { input: text, stdio: ["pipe", "ignore", "pipe"] }
    );
    if (done.error)
      throw new Error(
        `piper did not start (${done.error.message}): put it on PATH, e.g. \`uv tool install piper-tts\``
      );
    if (done.status !== 0)
      throw new Error(`piper failed: ${done.stderr.toString().trim()}`);
    return;
  }
  if (voice.engine === "elevenlabs") {
    const key = setting("ELEVENLABS_API_KEY");
    if (!key)
      throw new Error(
        "no ELEVENLABS_API_KEY in the environment or in ~/.config/shipcut/env"
      );
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.name)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      }
    );
    if (!response.ok)
      throw new Error(
        `ElevenLabs answered ${response.status} for ${voice.name}: ${(await response.text()).slice(0, 300)}`
      );
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
    return;
  }
  const key = setting("AZURE_SPEECH_KEY");
  const region = setting("AZURE_SPEECH_REGION");
  if (!key || !region)
    throw new Error(
      `no ${[!key && "AZURE_SPEECH_KEY", !region && "AZURE_SPEECH_REGION"].filter(Boolean).join(", ")} in the environment or in ~/.config/shipcut/env; or --voice piper:MODEL.onnx`
    );
  const xml = (t: string) =>
    t.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const response = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm",
        "User-Agent": "shipcut",
      },
      // A neural voice's name starts with its locale, `sk-SK-ViktoriaNeural`.
      body: `<speak version="1.0" xml:lang="${xml(voice.name.split("-").slice(0, 2).join("-"))}"><voice name="${xml(voice.name)}">${xml(text)}</voice></speak>`,
    }
  );
  if (!response.ok)
    throw new Error(
      `Azure Speech answered ${response.status} for ${voice.name}`
    );
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
}

/**
 * Speaks each step's `say` over the video, holding a step's last frame while
 * its line runs on, and writes the lines as an SRT beside it.
 */
export async function narrate(o: NarrateOptions): Promise<void> {
  const run = JSON.parse(readFileSync(join(o.dir, "run.json"), "utf-8")) as Run;
  const name = existsSync(join(o.dir, "video-polished.mp4"))
    ? "video-polished.mp4"
    : "video.mp4";
  const source = join(o.dir, name);
  if (resolve(o.out) === resolve(source))
    throw new Error("--out is the source video");
  const { duration, width = 16, height = 10 } = measure(source, name);
  if (!duration)
    throw new Error(
      `${o.dir} has no video.mp4: record with \`shipcut run --video\``
    );
  const segments = narrationSegments(run.steps, duration);
  const lines = segments.flatMap((s) => (s.say ? [s.say] : []));
  if (!lines.length)
    throw new Error(
      'no step to narrate: the scenario gives one a line with step(title, { say: "..." })'
    );

  console.error(
    `shipcut: ${lines.length} lines from ${name} in ${o.voice.name}`
  );
  const tmp = mkdtempSync(join(tmpdir(), "shipcut-narrate-"));
  try {
    const wavs = lines.map((_, i) => join(tmp, String(i)));
    for (const [i, line] of lines.entries())
      await speak(o.voice, line, wavs[i]!);
    const seconds = wavs.map((w) =>
      Number(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            w,
          ],
          { encoding: "utf-8" }
        )
      )
    );
    const srt = `${o.out.replace(/\.mp4$/, "")}.srt`;
    const plan = narrationPlan(segments, seconds);
    writeFileSync(srt, plan.srt);
    console.log(`${srt}  ${lines.length} lines`);
    // One ffmpeg per segment, then a concat: a single graph over n cuts of a
    // 2560x1600 video holds n decoders and their queues, past 1.5 GB at nine.
    const pieces = segments.map((s, i) => {
      const piece = join(tmp, `piece-${i}.mp4`);
      ffmpeg([
        "-y",
        "-ss",
        String(s.from),
        "-t",
        String(s.to - s.from),
        "-i",
        source,
        "-vf",
        `setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${plan.holds[i]}`,
        "-c:v",
        "libx264",
        "-crf",
        "14",
        "-preset",
        "veryfast",
        "-an",
        piece,
      ]);
      return piece;
    });
    const list = join(tmp, "pieces.txt");
    writeFileSync(list, pieces.map((p) => `file '${p}'`).join("\n"));
    const subtitles = `subtitles=filename=${filterValue(resolve(srt))}:fontsdir=${filterValue(FONTS)}:force_style=${filterValue(subtitleStyle(width, height))}`;
    produce(
      [
        "-y",
        ...wavs.flatMap((w) => ["-i", w]),
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list,
        "-filter_complex",
        `${plan.audio};[${wavs.length}:v]${o.subtitles ? subtitles : "null"}[v]`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        ...MP4.filter((a) => a !== "-an"),
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        o.out,
      ],
      o.out
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// libass sizes an SRT against a 288-line canvas scaled to the frame, so 13 is a 22nd of the height. A tall frame
// would get letters a third of its width wide, so there the size follows the width instead.
const subtitleStyle = (width: number, height: number) => {
  const size = Math.round(Math.min(13, (13 * width) / height));
  return `FontName=Inter,Bold=1,FontSize=${size},PrimaryColour=&H00FFFFFF,BackColour=&H99000000,BorderStyle=3,Outline=${Math.max(3, Math.round(size / 2))},Shadow=0,MarginV=22`;
};
