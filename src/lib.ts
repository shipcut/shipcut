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
      "frame-by-frame": { type: "boolean", default: false },
      slow: { type: "string" },
      "storage-state": { type: "string" },
      mask: { type: "boolean", default: false },
      "mask-selector": { type: "string", multiple: true },
      locale: { type: "string" },
      dark: { type: "boolean", default: false },
    },
  });
  const [scenario, ...rest] = positionals;
  if (!scenario || rest.length) throw new Error("usage: shots run <scenario> [flags]");
  if (values.preset && values.viewport) throw new Error("--preset and --viewport exclude each other");
  if (values.pointer && values.cursor) throw new Error("--pointer and --cursor both draw a pointer; --pointer is drawn by shots polish");
  if (values.pointer && !values.video) throw new Error("--pointer is drawn over the video, so it needs --video");
  if (values["frame-by-frame"] && !values.video) throw new Error("--frame-by-frame is a way to record the video, so it needs --video");
  if (values["frame-by-frame"] && values.slow)
    throw new Error("--slow pauses in wall-clock time, which --frame-by-frame does not keep; pause in the scenario instead");

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
    /** Chromium draws each frame on request, on a virtual clock: every frame of every animation is in the video. */
    frameByFrame: values["frame-by-frame"],
    slow: number("slow", values.slow) ?? 0,
    storageState: values["storage-state"],
    /** Under `--mask` or `--mask-selector`: the extra selectors to blur, beside the email and phone defaults. */
    mask: values.mask || values["mask-selector"]?.length ? (values["mask-selector"] ?? []) : undefined,
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
  // Whole milliseconds of the running time, not of each gap: a thirtieth of a
  // second rounded on its own loses a third of a millisecond a frame.
  for (let i = 0; i < offsetsMs.length; i++) {
    const from = i === 0 ? 0 : Math.round(offsetsMs[i]!);
    const to = Math.round(offsetsMs[i + 1] ?? endMs);
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
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      zoom: { type: "boolean", default: false },
      "zoom-factor": { type: "string" },
      labels: { type: "boolean", default: false },
      frame: { type: "boolean", default: false },
      background: { type: "string" },
    },
  });
  const [dir, ...rest] = positionals;
  if (!dir || rest.length)
    throw new Error("usage: shots polish <run-dir> [--labels] [--zoom] [--zoom-factor N] [--frame] [--background SPEC] [--out FILE]");
  const factor = number("zoom-factor", values["zoom-factor"]) ?? ZOOM.factor;
  if (factor <= 1) throw new Error("--zoom-factor wants a number above 1");
  return {
    dir,
    out: values.out ?? `${dir.replace(/\/$/, "")}/video-polished.mp4`,
    zoom: values.zoom ? factor : undefined,
    labels: values.labels,
    /** Under `--frame` or `--background`: the background's colours, one for a fill, two for a gradient. */
    frame: values.frame || values.background ? backgroundColors(values.background) : undefined,
  };
}

/**
 * How the camera moves under `polish --zoom`, in seconds: it takes `in` to
 * close in, finishing `lead` before the click, stays `hold` after the last
 * click of a run of them, and takes `out` to pull back. Clicks closer in time
 * than a zoom out, a `gap` and a zoom in would take share one zoom, panning
 * over `pan` to a click outside the middle of the view, so the picture never
 * rocks in and out. These numbers are the knob.
 */
export const ZOOM = { factor: 1.5, in: 0.5, lead: 0.1, hold: 1.2, out: 0.6, gap: 1, pan: 0.6 };

/** The camera at `t` seconds: `z` times closer, centred on `x`, `y` in video pixels. */
export type Keyframe = { t: number; z: number; x: number; y: number };

/**
 * The camera's keyframes for a video of `size` pixels and `seconds`, from the
 * pointer's clicks (CSS pixels, times `scale`). Between keyframes it eases;
 * outside them it shows the whole frame. Clicks in a step marked `zoom: false`
 * are left out. `spans` are the stretches in which it is closer than 1.
 */
export function zoomTrack(clicks: Point[], steps: Step[], size: { width: number; height: number; scale: number; seconds: number }, factor: number) {
  const { width: W, height: H, scale, seconds } = size;
  const sorted = [...steps].sort((a, b) => a.at - b.at);
  const zooms = (at: number) => sorted.findLast((s) => s.at <= at)?.zoom !== false;
  const points = clicks.filter(([at]) => zooms(at)).map(([at, x, y]) => ({ t: at / 1000, x: x * scale, y: y * scale }));
  const half = { x: W / (2 * factor), y: H / (2 * factor) };
  const aim = (p: { x: number; y: number }) => ({
    x: Math.min(Math.max(p.x, half.x), W - half.x),
    y: Math.min(Math.max(p.y, half.y), H - half.y),
  });
  const whole = { x: W / 2, y: H / 2 };
  const keys: Keyframe[] = [];
  const spans: [number, number][] = [];
  const key = (t: number, z: number, at: { x: number; y: number }) => {
    const clamped = Math.min(Math.max(t, keys.at(-1)?.t ?? 0, 0), seconds);
    keys.push({ t: Math.round(clamped * 1000) / 1000, z, x: Math.round(at.x), y: Math.round(at.y) });
  };
  const apart = ZOOM.hold + ZOOM.out + ZOOM.gap + ZOOM.in + ZOOM.lead;
  for (let i = 0; i < points.length; ) {
    let j = i;
    while (j + 1 < points.length && points[j + 1]!.t - points[j]!.t < apart) j++;
    let center = aim(points[i]!);
    key(points[i]!.t - ZOOM.lead - ZOOM.in, 1, whole);
    const from = keys.at(-1)!.t;
    key(points[i]!.t - ZOOM.lead, factor, center);
    for (let k = i + 1; k <= j; k++) {
      const p = points[k]!;
      // A click still in the middle of the view needs no pan.
      if (Math.abs(p.x - center.x) < half.x * 0.6 && Math.abs(p.y - center.y) < half.y * 0.6) continue;
      key(p.t - ZOOM.lead - ZOOM.pan, factor, center);
      center = aim(p);
      key(p.t - ZOOM.lead, factor, center);
    }
    key(points[j]!.t + ZOOM.hold, factor, center);
    key(points[j]!.t + ZOOM.hold + ZOOM.out, 1, whole);
    spans.push([from, keys.at(-1)!.t]);
    i = j + 1;
  }
  return { keys, spans };
}

/**
 * The `perspective` filter that plays a camera track: each corner is an
 * expression of the frame's time that eases `z`, `x` and `y` between the
 * keyframes around it and picks the source rectangle the frame shows, in
 * fractions of a pixel, so a slow zoom does not shake. Registers 1 to 3 hold
 * `z`, `x` and `y`, register 0 the eased progress.
 */
export function zoomFilter(keys: Keyframe[], size: { width: number; height: number }, fps = FPS): string {
  const T = `(in/${fps})`;
  let camera = `st(1,1);st(2,${size.width / 2});st(3,${size.height / 2})`;
  for (let k = keys.length - 2; k >= 0; k--) {
    const a = keys[k]!;
    const b = keys[k + 1]!;
    if (b.t <= a.t) continue;
    const ease = `st(0,(${T}-${a.t})/${(b.t - a.t).toFixed(3)});st(0,if(lt(ld(0),0.5),4*ld(0)^3,1-(2-2*ld(0))^3/2))`;
    const lerp = (r: number, from: number, to: number) => `st(${r},${from}+${to - from}*ld(0))`;
    camera = `if(between(${T},${a.t},${b.t}),${ease};${lerp(1, a.z, b.z)};${lerp(2, a.x, b.x)};${lerp(3, a.y, b.y)},${camera})`;
  }
  const left = `${camera};ld(2)-W/(2*ld(1))`;
  const right = `${camera};ld(2)+W/(2*ld(1))`;
  const top = `${camera};ld(3)-H/(2*ld(1))`;
  const bottom = `${camera};ld(3)+H/(2*ld(1))`;
  const corners = { x0: left, y0: top, x1: right, y1: top, x2: left, y2: bottom, x3: right, y3: bottom };
  return `perspective=${Object.entries(corners).map(([k, v]) => `${k}='${v}'`).join(":")}:interpolation=cubic:eval=frame`;
}

/** Something `polish` draws: SVG in CSS pixels, its width, and the point of it that sits on the pointer's position. */
export type Sprite = { svg: string; width: number; hotspot: { x: number; y: number } };

const svg = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
const SHADOW = '<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dy="1" stdDeviation="1" flood-opacity=".4"/></filter></defs>';

/** An arrow with its tip at `x`, `y`, `size` times its usual 18x27: a 14x21 drawing whose tip sits at 1, 1. */
const arrow = (x: number, y: number, size = 1) =>
  `<path transform="translate(${x} ${y}) scale(${(1.2857 * size).toFixed(4)}) translate(-1 -1)" d="M1 1V17L5 13.2L7.8 19.6L10.2 18.6L7.5 12.3H12.8Z" ` +
  'fill="#111" stroke="#fff" stroke-width="1.3" stroke-linejoin="round" filter="url(#s)"/>';

/** The pointer, an arrow on every preset; the tip is the hotspot. */
export const POINTER: Sprite = { width: 24, hotspot: { x: 4.3, y: 4.3 }, svg: svg(24, 33, `${SHADOW}${arrow(4.3, 4.3)}`) };

/** How the arrow sizes through a press, one value a frame: it gives under the finger and springs back. */
const PRESS = [0.92, 0.86, 0.85, 0.9, 0.96, 1];
/** The frames of a press in which the click sprite draws the arrow, so the pointer itself is hidden for them. */
export const PRESS_FRAMES = PRESS.length;

/**
 * What a press shows, one sprite per video frame over 450 ms, centred on the
 * click: a wave in the labels' colour that grows and fades, and for its first
 * frames the arrow giving under the finger. The arrow is drawn here rather
 * than by the pointer's own overlay because it changes size frame by frame.
 */
export function clickFrames(fps = FPS): Sprite[] {
  const count = Math.round(0.45 * fps);
  return Array.from({ length: count }, (_, k) => {
    const p = k / (count - 1);
    const radius = 6 + 22 * (1 - (1 - p) ** 2);
    const wave =
      `<circle cx="37" cy="37" r="${radius.toFixed(2)}" fill="${LABEL.color}" fill-opacity="${(0.25 * (1 - p)).toFixed(3)}" ` +
      `stroke="${LABEL.color}" stroke-opacity="${(1 - p).toFixed(3)}" stroke-width="2"/>`;
    const press = PRESS[k];
    return { width: 74, hotspot: { x: 37, y: 37 }, svg: svg(74, 74, `${SHADOW}${wave}${press ? arrow(37, 37, press) : ""}`) };
  });
}

/**
 * ffmpeg `sendcmd` lines that move the overlay `target` with the pointer: one
 * for each frame from `from` to `to` seconds in which its place changes.
 * `place` turns the pointer's position (CSS pixels) into the overlay's
 * top-left corner (video pixels). Each line fires half a frame early, so a
 * rounded timestamp cannot land it on the next frame.
 */
export function follow(
  moves: Point[],
  target: string,
  from: number,
  to: number,
  place: (x: number, y: number) => { x: number; y: number },
  fps = FPS,
): string[] {
  const lines: string[] = [];
  let i = 0;
  let last = "";
  for (let frame = Math.max(0, Math.floor(from * fps)); frame < Math.round(to * fps); frame++) {
    const ms = (frame * 1000) / fps;
    while (i < moves.length - 1 && moves[i + 1]![0] <= ms) i++;
    if (!moves[i] || moves[i]![0] > ms) continue;
    const { x, y } = place(moves[i]![1], moves[i]![2]);
    if (`${x},${y}` === last) continue;
    last = `${x},${y}`;
    lines.push(`${Math.max(0, (frame - 0.5) / fps).toFixed(4)} ${target} x ${x}, ${target} y ${y};`);
  }
  return lines;
}

/** The pointer sprite's track from its first move on: `from` (seconds) and `start` place it, `commands` move it. */
export function pointerTrack(moves: Point[], seconds: number, scale: number, hotspot: { x: number; y: number }, fps = FPS) {
  const first = moves[0];
  if (!first) return undefined;
  const corner = (x: number, y: number) => ({ x: Math.round((x - hotspot.x) * scale), y: Math.round((y - hotspot.y) * scale) });
  return {
    from: first[0] / 1000,
    start: corner(first[1], first[2]),
    commands: follow(moves, "overlay@pointer", 0, seconds, corner, fps),
  };
}

/**
 * The label beside the pointer under `polish --labels`, in CSS pixels: a pill
 * in the step's words, as wide as its text, in the colour presses wave in. It shows from the step until the
 * next, for `seconds` at most, fading in and out. These numbers are the knob.
 */
export const LABEL = { size: 14, padX: 10, padY: 6, radius: 8, margin: 4, color: "#6C5CE7", chars: 32, seconds: 4, fade: 0.2 };

/** What a `story`'s feed covers with its own controls, in its 1080x1920 pixels. */
export const STORY_SAFE = { top: 250, bottom: 340 };

const LABEL_FONT = `font-family="Inter, sans-serif" font-weight="600" font-size="${LABEL.size}"`;
const xml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A step's title as its label shows it: one line, cut with an ellipsis past `LABEL.chars`. */
export function labelText(title: string): string {
  const text = title.trim().replace(/\s+/g, " ");
  return text.length > LABEL.chars ? `${text.slice(0, LABEL.chars - 1).trimEnd()}…` : text;
}

/** The label windows: each captioned step's title, from the step (or the pointer's first move) to the next step, `LABEL.seconds` at most. */
export function labelWindows(steps: Step[], seconds: number, pointerFrom: number) {
  return captionTimeline(steps, seconds).flatMap(({ title, from, to }) => {
    const start = Math.max(from, pointerFrom);
    const end = Math.min(to, start + LABEL.seconds);
    return end - start >= 0.5 ? [{ text: labelText(title), from: start, to: end }] : [];
  });
}

/** An SVG of a label's text alone, white on black, starting `LABEL.padX` in: ffmpeg's `bbox` finds its ink, since nothing here knows the font's metrics. */
export function labelProbe(text: string) {
  const width = Math.ceil(text.length * LABEL.size * 0.8 + 2 * LABEL.padX);
  const body = `<rect width="${width}" height="${LABEL.size * 2}"/><text x="${LABEL.padX}" y="${LABEL.size * 1.4}" fill="#fff" ${LABEL_FONT}>${xml(text)}</text>`;
  return { width, svg: svg(width, LABEL.size * 2, body) };
}

/**
 * The label's sprite: a pill as wide as the text's ink plus padding, with a
 * shadow in the margin around it. `ink` is in CSS pixels, `left` measured
 * from where the text starts. The hotspot is the pill's top-left corner.
 */
export function labelSprite(text: string, ink: { left: number; width: number }): Sprite & { pill: { width: number; height: number } } {
  const width = Math.ceil(ink.width + 2 * LABEL.padX);
  const height = LABEL.size + 2 * LABEL.padY;
  const m = LABEL.margin;
  // Capitals take about 0.72 of the size: this baseline centres them.
  const baseline = (height + 0.72 * LABEL.size) / 2;
  return {
    width: width + 2 * m,
    hotspot: { x: m, y: m },
    pill: { width, height },
    svg: svg(
      width + 2 * m,
      height + 2 * m,
      `${SHADOW}<rect x="${m}" y="${m}" width="${width}" height="${height}" rx="${LABEL.radius}" fill="${LABEL.color}" filter="url(#s)"/>` +
        `<text x="${(m + LABEL.padX - ink.left).toFixed(2)}" y="${(m + baseline).toFixed(2)}" fill="#fff" ${LABEL_FONT}>${xml(text)}</text>`,
    ),
  };
}

/**
 * Where a label's pill goes for a pointer at `p`, all in CSS pixels: below and
 * right of the arrow's tip, on its left where the right edge is near, and
 * never outside the frame or in its `safe` zones.
 */
export function labelPlace(
  p: { x: number; y: number },
  pill: { width: number; height: number },
  frame: { width: number; height: number },
  safe = { top: 0, bottom: 0 },
) {
  const gap = { x: 14, y: 20 };
  let x = p.x + gap.x;
  if (x + pill.width > frame.width - 8) x = p.x - gap.x - pill.width;
  const y = Math.min(Math.max(p.y + gap.y, safe.top + 8), frame.height - safe.bottom - 8 - pill.height);
  return { x: Math.max(8, x), y };
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

/** The background `--frame` paints unless `--background` says otherwise: lavender into pale blue. */
export const BACKGROUND = ["#E4DDFF", "#C9DCFF"];

/** `--background`: one `#rgb` or `#rrggbb` colour for a fill, two joined by a comma for a diagonal gradient. */
export function backgroundColors(spec: string | undefined): string[] {
  if (spec === undefined) return BACKGROUND;
  const colors = spec.split(",").map((c) => c.trim());
  if (colors.length > 2 || !colors.every((c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)))
    throw new Error(`--background wants #rrggbb or #rrggbb,#rrggbb, got "${spec}"`);
  return colors;
}

/**
 * Where `--frame` puts the recording in a video of `size` pixels: scaled
 * down to leave a margin of 7% of the short side, centred, and for a story
 * inside its safe zones. The window keeps the recording's shape and even
 * dimensions; its corners round by 2.5% of the short side.
 */
export function frameLayout(size: { width: number; height: number }, preset?: string) {
  const short = Math.min(size.width, size.height);
  const margin = 0.07 * short;
  const safe = preset === "story" ? STORY_SAFE : { top: 0, bottom: 0 };
  const room = { width: size.width - 2 * margin, height: size.height - safe.top - safe.bottom - 2 * margin };
  const fit = Math.min(room.width / size.width, room.height / size.height);
  const even = (n: number) => 2 * Math.round(n / 2);
  const width = even(size.width * fit);
  const height = even(size.height * fit);
  return {
    width,
    height,
    x: even((size.width - width) / 2),
    y: even(safe.top + (size.height - safe.top - safe.bottom - height) / 2),
    radius: Math.round(0.025 * short),
  };
}

/** The still behind the window: the background and the window's soft shadow, at the video's size. */
export function backgroundSvg(size: { width: number; height: number }, window: ReturnType<typeof frameLayout>, colors: string[]) {
  const short = Math.min(size.width, size.height);
  const fill = colors.length === 1 ? colors[0]! : "url(#g)";
  const gradient =
    colors.length === 2
      ? `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>`
      : "";
  const blur = `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(0.025 * short).toFixed(1)}"/></filter>`;
  const { x, y, width, height, radius } = window;
  return svg(
    size.width,
    size.height,
    `<defs>${gradient}${blur}</defs><rect width="${size.width}" height="${size.height}" fill="${fill}"/>` +
      `<rect x="${x}" y="${y + Math.round(0.012 * short)}" width="${width}" height="${height}" rx="${radius}" fill="#000" fill-opacity=".35" filter="url(#b)"/>`,
  );
}

/** The window's alpha: white where the recording shows, a rounded rectangle on black. */
export const windowMask = (window: ReturnType<typeof frameLayout>) =>
  svg(window.width, window.height, `<rect width="${window.width}" height="${window.height}"/><rect width="${window.width}" height="${window.height}" rx="${window.radius}" fill="#fff"/>`);
