// The pure parts: ids, flags, ffmpeg arguments, the index and the Markdown.
import { basename, extname } from "node:path";
import { parseArgs } from "node:util";
import type { IndexEntry, Manifest, Point, Run, Step } from "./types.ts";

/**
 * Sizes are CSS pixels, and `scale` multiplies them into the pixels of the
 * shots and the video. `post` and `story` are a phone's layout at the size a
 * feed wants: 360 CSS pixels wide, times 3, is 1080. At 1080 CSS pixels a site
 * serves its desktop layout, which is not what a story shows.
 */
export const PRESETS = {
  desktop: { width: 1280, height: 800, scale: 1, mobile: false },
  phone: { width: 390, height: 844, scale: 1, mobile: true },
  post: { width: 360, height: 450, scale: 3, mobile: true },
  story: { width: 360, height: 640, scale: 3, mobile: true },
} as const;

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** `20261002-134501-landing`: UTC to the second, then the scenario's file name. */
export function runId(now: Date, scenario: string): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `${stamp}-${slug(basename(scenario, extname(scenario))) || "run"}`;
}

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".json": "application/json",
};
export const contentType = (file: string) =>
  TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";

function number(flag: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${flag} wants a number, got "${value}"`);
  return n;
}

export type RunOptions = ReturnType<typeof runOptions>;

/** Flags of `shots run`, resolved to what the browser needs. */
export function runOptions(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      base: { type: "string", default: "http://localhost:3000" },
      out: { type: "string" },
      preset: { type: "string" },
      viewport: { type: "string" },
      scale: { type: "string" },
      video: { type: "boolean", default: false },
      cursor: { type: "boolean", default: false },
      pointer: { type: "boolean", default: false },
      slow: { type: "string" },
      "storage-state": { type: "string" },
      locale: { type: "string" },
      dark: { type: "boolean", default: false },
    },
  });
  const [scenario, ...rest] = positionals;
  if (!scenario || rest.length) throw new Error("usage: shots run <scenario> [flags]");
  if (values.preset && values.viewport) throw new Error("--preset and --viewport exclude each other");
  if (values.pointer && values.cursor) throw new Error("--pointer and --cursor both draw a pointer; --pointer is drawn by shots polish");
  if (values.pointer && !values.video) throw new Error("--pointer is drawn over the video, so it needs --video");

  const preset: string | undefined = values.preset ?? (values.viewport ? undefined : "desktop");
  let size: { width: number; height: number; scale: number; mobile: boolean };
  if (values.viewport) {
    const match = /^(\d+)x(\d+)$/.exec(values.viewport);
    if (!match) throw new Error(`--viewport wants WxH, got "${values.viewport}"`);
    size = { width: Number(match[1]), height: Number(match[2]), scale: 1, mobile: false };
  } else {
    if (!preset || !(preset in PRESETS))
      throw new Error(`--preset is one of ${Object.keys(PRESETS).join(", ")}`);
    size = PRESETS[preset as keyof typeof PRESETS];
  }

  return {
    scenario,
    base: values.base.replace(/\/$/, ""),
    out: values.out,
    preset,
    viewport: { width: size.width, height: size.height, scale: number("scale", values.scale) || size.scale },
    /** Touch and the mobile viewport, as a phone reports them. */
    mobile: size.mobile,
    video: values.video,
    cursor: values.cursor,
    pointer: values.pointer,
    slow: number("slow", values.slow) ?? 0,
    storageState: values["storage-state"],
    locale: values.locale,
    dark: values.dark,
  };
}

export type ClipOptions = ReturnType<typeof clipOptions>;

export function clipOptions(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      from: { type: "string" },
      to: { type: "string" },
      speed: { type: "string" },
      width: { type: "string" },
      gif: { type: "boolean", default: false },
      out: { type: "string" },
    },
  });
  const [input, ...rest] = positionals;
  if (!input || rest.length) throw new Error("usage: shots clip <video> [flags]");
  const stem = input.slice(0, input.length - extname(input).length);
  return {
    input,
    from: number("from", values.from),
    to: number("to", values.to),
    speed: number("speed", values.speed),
    width: number("width", values.width),
    gif: values.gif,
    out: values.out ?? (values.gif ? `${stem}.gif` : `${stem}-clip.mp4`),
  };
}

/** H.264 that X, Threads and Safari play: 4:2:0, even dimensions, moov atom first. */
export const MP4 = ["-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"];
const EVEN = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

/** Frames per second of a recording, constant whatever the page did. */
export const FPS = 30;

/**
 * How long the pointer takes to cross `distance` CSS pixels: farther is
 * longer, up to a ceiling, so a long move is quick and a short one still
 * reads as a move. The three numbers are the knob.
 */
export const glideMs = (distance: number) => Math.round(Math.min(900, 250 + distance * 0.9));

/**
 * The pointer's way from `from` to `to`: a shallow arc, slow at both ends,
 * one point every sixtieth of a second, each `[ms, x, y]` from the start of
 * the move. Empty when it is already there.
 */
export function glidePath(from: { x: number; y: number }, to: { x: number; y: number }): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) return [];
  const ms = glideMs(distance);
  // The arc's control point sits off the straight line by a sixth of its length.
  const cx = from.x + dx / 2 - dy / 6;
  const cy = from.y + dy / 2 + dx / 6;
  const points: Point[] = [];
  for (let at = 0; ; at = Math.min(at + 1000 / 60, ms)) {
    const p = at / ms;
    const t = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
    const u = 1 - t;
    points.push([Math.round(at), u * u * from.x + 2 * u * t * cx + t * t * to.x, u * u * from.y + 2 * u * t * cy + t * t * to.y]);
    if (at === ms) return points;
  }
}

/** The file a captured frame is stored under, `000001.jpg` for the first. */
export const frameName = (n: number) => `${String(n + 1).padStart(6, "0")}.jpg`;

/**
 * The ffconcat list that turns stored frames into a video with the wall
 * clock's timing: each frame shows until the next one arrived, the first from
 * the start of the recording, the last until `endMs`. The demuxer ignores the
 * last duration unless the last file is listed once more, so it is.
 */
export function concatList(offsetsMs: number[], endMs: number): string {
  if (!offsetsMs.length) throw new Error("no frames to list");
  const lines = ["ffconcat version 1.0"];
  for (let i = 0; i < offsetsMs.length; i++) {
    const from = i === 0 ? 0 : offsetsMs[i]!;
    const to = offsetsMs[i + 1] ?? endMs;
    lines.push(`file ${frameName(i)}`, `duration ${(Math.max(to - from, 1) / 1000).toFixed(3)}`);
  }
  lines.push(`file ${frameName(offsetsMs.length - 1)}`);
  return `${lines.join("\n")}\n`;
}

/** The ffmpeg arguments that encode a concat list of JPEG frames into a video `seconds` long. */
export function recordArgs(list: string, out: string, seconds: number, fps = FPS): string[] {
  // The frames are full-range BT.601 JPEGs. Players take an untagged HD file
  // for limited-range BT.709, so it is converted and tagged, else black is grey.
  // zscale, because swscale either rounds a white page to #fbfdfa or, told to
  // be accurate, takes four times the CPU. The crop keeps the dimensions even.
  // fps comes last, so a frame is decoded and converted once and its repeats
  // are copies of the converted picture. -t, because the list's repeated last
  // file adds a frame of its own past the recording's end.
  const vf = `crop=trunc(iw/2)*2:trunc(ih/2)*2,zscale=min=170m:rin=full:m=709:r=limited,format=yuv420p,fps=${fps}`;
  return ["-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", vf, "-t", seconds.toFixed(3), ...MP4, ...BT709, "-preset", "medium", out];
}

/** The tags of a limited-range BT.709 file, which every video here is. */
export const BT709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

export type PolishOptions = ReturnType<typeof polishOptions>;

export function polishOptions(argv: string[]) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { out: { type: "string" } } });
  const [dir, ...rest] = positionals;
  if (!dir || rest.length) throw new Error("usage: shots polish <run-dir> [--out FILE]");
  return { dir, out: values.out ?? `${dir.replace(/\/$/, "")}/video-polished.mp4` };
}

/** Something `polish` draws: SVG in CSS pixels, its width, and the point of it that sits on the pointer's position. */
export type Sprite = { svg: string; width: number; hotspot: { x: number; y: number } };

const svg = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
const SHADOW = '<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dy="1" stdDeviation="1" flood-opacity=".4"/></filter></defs>';

/** The pointer: an arrow on a desktop, a fingertip where the run was a touch device. */
export function pointerSprite(touch: boolean): Sprite {
  if (touch)
    return {
      width: 40,
      hotspot: { x: 20, y: 20 },
      svg: svg(40, 40, `${SHADOW}<circle cx="20" cy="20" r="14.25" fill="#fff" fill-opacity=".55" stroke="#000" stroke-opacity=".3" stroke-width="1.5" filter="url(#s)"/>`),
    };
  // The tip is the hotspot; the arrow is a 14x21 drawing at 18x27.
  return {
    width: 24,
    hotspot: { x: 4.3, y: 4.3 },
    svg: svg(
      24,
      33,
      `${SHADOW}<path transform="translate(3 3) scale(1.2857)" d="M1 1V17L5 13.2L7.8 19.6L10.2 18.6L7.5 12.3H12.8Z" ` +
        'fill="#111" stroke="#fff" stroke-width="1.3" stroke-linejoin="round" filter="url(#s)"/>',
    ),
  };
}

/** The ring a press leaves, one sprite per video frame: it grows to three times its size and fades out over 450 ms. */
export function ringFrames(fps = FPS): Sprite[] {
  const count = Math.round(0.45 * fps);
  return Array.from({ length: count }, (_, k) => {
    const p = k / (count - 1);
    const grow = 1 + 2 * (1 - (1 - p) ** 2);
    return {
      width: 74,
      hotspot: { x: 37, y: 37 },
      svg: svg(
        74,
        74,
        `<g transform="translate(37 37) scale(${grow.toFixed(3)})" opacity="${(1 - p).toFixed(3)}" fill="none">` +
          '<circle r="11.5" stroke="#000" stroke-opacity=".35"/><circle r="10" stroke="#fff" stroke-width="2"/></g>',
      ),
    };
  });
}

/**
 * Where the pointer sprite's top-left corner goes, in video pixels, from the
 * first move on: `start` and `from` (seconds) place it, and `commands` are
 * ffmpeg `sendcmd` lines for the overlay named `pointer`, one for each frame
 * in which it moved. Each fires half a frame early, so a rounded timestamp
 * cannot land it on the next frame.
 */
export function pointerTrack(moves: Point[], seconds: number, scale: number, hotspot: { x: number; y: number }, fps = FPS) {
  const first = moves[0];
  if (!first) return undefined;
  const corner = (p: Point) => ({ x: Math.round((p[1] - hotspot.x) * scale), y: Math.round((p[2] - hotspot.y) * scale) });
  const lines: string[] = [];
  let i = 0;
  let last = "";
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) {
    const ms = (frame * 1000) / fps;
    while (i < moves.length - 1 && moves[i + 1]![0] <= ms) i++;
    if (moves[i]![0] > ms) continue;
    const { x, y } = corner(moves[i]!);
    if (`${x},${y}` === last) continue;
    last = `${x},${y}`;
    lines.push(`${Math.max(0, (frame - 0.5) / fps).toFixed(4)} overlay@pointer x ${x}, overlay@pointer y ${y};`);
  }
  return { from: first[0] / 1000, start: corner(first), commands: `${lines.join("\n")}\n` };
}


export function measureOptions(argv: string[]) {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true });
  const [dir, ...rest] = positionals;
  if (!dir || rest.length) throw new Error("usage: shots measure <run-dir>");
  return { dir };
}

/** The frame count ffmpeg's progress line reports last: the frames `mpdecimate` let through. */
export function framesKept(stderr: string): number {
  const counts = [...stderr.matchAll(/frame=\s*(\d+)/g)];
  if (!counts.length) throw new Error("ffmpeg printed no frame count");
  return Number(counts[counts.length - 1]![1]);
}

/**
 * What `shots measure` prints: distinct frames a second, the video's length
 * against the seconds recorded, and the repaints Chromium sent. One fact a
 * line, the number first, so a before and after can sit side by side.
 */
export function measureLines(run: Run, duration: number, distinct: number): string[] {
  const lines = [`${(distinct / duration).toFixed(1)} distinct frames/s (${distinct} of ${Math.round(duration * FPS)} at ${FPS} fps)`];
  lines.push(`${duration.toFixed(2)}s video`);
  if (run.recording) {
    const drift = duration - run.recording.seconds;
    lines.push(`${drift >= 0 ? "+" : ""}${(drift * 1000).toFixed(0)} ms against the ${run.recording.seconds.toFixed(2)}s recorded`);
    lines.push(`${(run.recording.repaints / run.recording.seconds).toFixed(1)} repaints/s from Chromium (${run.recording.repaints})`);
  }
  lines.push(`${run.steps.length} steps, last at ${((run.steps.at(-1)?.at ?? 0) / 1000).toFixed(2)}s`);
  return lines;
}

export type CaptionOptions = ReturnType<typeof captionOptions>;

export function captionOptions(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { out: { type: "string" }, font: { type: "string" } },
  });
  const [dir, ...rest] = positionals;
  if (!dir || rest.length) throw new Error("usage: shots caption <run-dir> [--out FILE] [--font FILE]");
  return { dir, out: values.out ?? `${dir.replace(/\/$/, "")}/video-captioned.mp4`, font: values.font };
}

export type Caption = { title: string; from: number; to: number };

/**
 * When each step's title is on screen, in seconds: from its own offset to the
 * next step's, the last one to the end. A step marked `caption: false` shows
 * nothing and still ends the caption before it.
 */
export function captionTimeline(steps: Step[], duration: number): Caption[] {
  const sorted = [...steps].sort((a, b) => a.at - b.at);
  return sorted.flatMap((step, i) => {
    const from = step.at / 1000;
    const to = Math.min((sorted[i + 1]?.at ?? Infinity) / 1000, duration);
    return step.caption === false || !step.title.trim() || to <= from ? [] : [{ title: step.title.trim(), from, to }];
  });
}

/** Greedy wrap into lines of at most `max` characters; a longer word stays whole. */
export function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/**
 * A value for an option of a filter in `-vf`. ffmpeg unescapes twice: the
 * graph takes `\ ' , ; [ ]`, then the filter's options take `\ ' :`. So what
 * both read is escaped twice, and what only the graph reads once.
 */
export const filterValue = (text: string) =>
  text.replace(/[\\':]/g, "\\$&").replace(/[\\',;[\]]/g, "\\$&");

// ponytail: no font metrics, a glyph is taken to be 0.68 of the font size wide
// (DejaVu Sans Bold averages a little under that). A font much wider overflows
// the 90% line; measure with a drawtext dry run if that ever shows.
const GLYPH = 0.68;

/** Where a caption of these lines sits in a frame: a band across it, low. */
export function captionLayout(title: string, frame: { width: number; height: number }) {
  const usable = frame.width * 0.9;
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length));
  // Relative to the frame's short side; one word too long for a line shrinks it.
  const size = Math.floor(Math.min(Math.min(frame.width, frame.height) / 22, usable / (GLYPH * longest)));
  const lines = wrap(title, Math.floor(usable / (GLYPH * size)));
  const lineHeight = Math.round(size * 1.35);
  const pad = Math.round(size * 0.6);
  const height = lines.length * lineHeight + 2 * pad;
  // A story's bottom eighth is under the platform's own controls, so a tall
  // frame lifts the band clear of it. Either way the middle stays free.
  const bottom = frame.height > frame.width ? Math.round(frame.height * 0.88) : frame.height;
  return { lines, size, lineHeight, pad, height, top: bottom - height };
}

/**
 * The `-vf` value that burns the captions in: white text on an opaque black
 * band, so the page never shows through, with a white rule above and below,
 * so the band still reads as one on a black page.
 */
export function captionFilter(captions: Caption[], frame: { width: number; height: number }, font?: string): string {
  return captions
    .flatMap((c) => {
      const l = captionLayout(c.title, frame);
      const enable = `enable=${filterValue(`between(t,${c.from.toFixed(3)},${c.to.toFixed(3)})`)}`;
      const face = font ? `fontfile=${filterValue(font)}:` : "";
      const rule = Math.max(2, Math.round(l.size / 16));
      const box = (y: number, height: number, colour: string) =>
        `drawbox=x=0:y=${y}:w=iw:h=${height}:color=${colour}:t=fill:${enable}`;
      return [
        box(l.top, l.height, "black"),
        box(l.top, rule, "white"),
        box(l.top + l.height - rule, rule, "white"),
        ...l.lines.map(
          (line, i) =>
            `drawtext=${face}text=${filterValue(line)}:expansion=none:fontsize=${l.size}:fontcolor=white:` +
            `x=(w-text_w)/2:y=${l.top + l.pad + i * l.lineHeight + Math.round((l.lineHeight - l.size) / 2)}:y_align=font:${enable}`,
        ),
      ];
    })
    .join(",");
}

/** The ffmpeg arguments for `shots clip`. */
export function clipArgs(o: ClipOptions): string[] {
  // Seeking before -i is fast, and exact here because the output is re-encoded.
  const seek = [
    ...(o.from === undefined ? [] : ["-ss", String(o.from)]),
    ...(o.to === undefined ? [] : ["-to", String(o.to)]),
  ];
  const filters = o.speed ? [`setpts=PTS/${o.speed}`] : [];
  if (o.gif) {
    // A GIF at full size and frame rate runs to tens of megabytes, so it gets
    // 12 fps and 640px unless told otherwise, and its own palette to stay sharp.
    filters.push("fps=12", `scale=${o.width ?? 640}:-1:flags=lanczos`);
    const graph = `${filters.join(",")},split[a][b];[a]palettegen[p];[b][p]paletteuse`;
    return ["-y", ...seek, "-i", o.input, "-filter_complex", graph, o.out];
  }
  filters.push(o.width ? `scale=${o.width}:-2` : EVEN);
  return ["-y", ...seek, "-i", o.input, "-vf", filters.join(","), ...MP4, o.out];
}

export function indexEntry(m: Manifest, manifestUrl: string): IndexEntry {
  return {
    id: m.id,
    title: m.title,
    scenario: m.scenario,
    createdAt: m.createdAt,
    manifest: manifestUrl,
    cover: m.files.find((f) => f.contentType.startsWith("image/"))?.url,
    files: m.files.length,
  };
}

/**
 * The index a project should have: an entry for every stored run id, newest
 * first. A later `known` entry wins over an earlier one with the same id; ids
 * nobody knows come back as `missing`.
 */
export function buildIndex(ids: string[], known: IndexEntry[]) {
  const byId = new Map(known.map((e) => [e.id, e]));
  return {
    index: ids.flatMap((id) => byId.get(id) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    missing: ids.filter((id) => !byId.has(id)),
  };
}

/** The block to paste into a changelog or a PR. */
export function markdown(m: Manifest): string {
  const lines = m.title ? [`**${m.title}**`, ""] : [];
  const videos = m.files.filter((f) => f.contentType.startsWith("video/"));
  for (const f of m.files)
    if (f.contentType.startsWith("image/")) lines.push(`![${basename(f.name, extname(f.name))}](${f.url})`, "");
  for (const f of videos) {
    const seconds = f.duration === undefined ? "" : `, ${f.duration.toFixed(1)}s`;
    lines.push(`[${f.name}${seconds}](${f.url})`, "");
  }
  return lines.join("\n").trimEnd();
}
