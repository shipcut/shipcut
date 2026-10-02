// The pure parts: ids, flags, ffmpeg arguments, the index and the Markdown.
import { basename, extname } from "node:path";
import { parseArgs } from "node:util";
import type { IndexEntry, Manifest } from "./types.ts";

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
      slow: { type: "string" },
      "storage-state": { type: "string" },
      locale: { type: "string" },
      dark: { type: "boolean", default: false },
    },
  });
  const [scenario, ...rest] = positionals;
  if (!scenario || rest.length) throw new Error("usage: shots run <scenario> [flags]");
  if (values.preset && values.viewport) throw new Error("--preset and --viewport exclude each other");

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
 * How many copies of the frame on screen the encoder is owed `elapsedMs` into
 * a recording that has `written` so far. Chromium sends a frame only when the
 * page changes, so the gaps are filled with the frame that was showing, and
 * the video's clock stays the wall clock's.
 */
export const framesDue = (elapsedMs: number, written: number, fps = FPS) =>
  Math.max(0, Math.round((elapsedMs * fps) / 1000) - written);

/** The ffmpeg arguments that turn JPEG frames on stdin into the run's video. */
export function recordArgs(out: string, fps = FPS): string[] {
  // The frames are full-range BT.601 JPEGs. Players take an untagged HD file
  // for limited-range BT.709, so it is converted and tagged, else black is grey.
  // zscale, because swscale either rounds a white page to #fbfdfa or, told to
  // be accurate, takes four times the CPU. The crop keeps the dimensions even.
  const vf = "crop=trunc(iw/2)*2:trunc(ih/2)*2,zscale=min=170m:rin=full:m=709:r=limited,format=yuv420p";
  const tags = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];
  // veryfast, because the encoder shares four cores with the browser it records.
  return ["-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-", "-vf", vf, ...MP4, ...tags, "-preset", "veryfast", out];
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
