import assert from "node:assert/strict";
import { test } from "node:test";

import type { PRESETS } from "../src/lib.ts";
import {
  authorization,
  buildIndex,
  canonicalQuery,
  canonicalRequest,
  keyPath,
  parseListing,
  sha256,
  uriEncode,
  captionFilter,
  captionLayout,
  captionOptions,
  captionTimeline,
  narrationPlan,
  narrationSegments,
  clipArgs,
  clipOptions,
  filterValue,
  concatList,
  glideMs,
  glidePath,
  labelPlace,
  labelText,
  labelWindows,
  pointerTrack,
  polishOptions,
  polishPlan,
  zoomTrack,
  backgroundColors,
  clickFrames,
  frameLayout,
  framesKept,
  measureLines,
  indexEntry,
  markdown,
  recordArgs,
  runId,
  runOptions,
  wrap,
  detectAgents,
  devServer,
  ffmpegInstall,
  initOptions,
} from "../src/lib.ts";
import type { IndexEntry, Manifest, Run } from "../src/types.ts";

test("a run id is the UTC second and the scenario's file name", () => {
  assert.equal(
    runId(new Date("2026-10-02T13:45:01.999Z"), "flows/Book a Table.ts"),
    "20261002-134501-book-a-table"
  );
  assert.equal(
    runId(new Date("2026-01-05T03:04:05Z"), "---.mjs"),
    "20260105-030405-run"
  );
});

test("run flags resolve to a viewport", () => {
  const plain = runOptions(["a.ts"]);
  assert.deepEqual(plain.viewport, { width: 1280, height: 800, scale: 1 });
  assert.equal(plain.preset, "desktop");
  assert.equal(plain.base, "http://localhost:3000");

  const story = runOptions([
    "a.ts",
    "--preset",
    "story",
    "--scale",
    "2",
    "--video",
    "--base",
    "https://x.dev/",
  ]);
  assert.deepEqual(story.viewport, { width: 360, height: 640, scale: 2 });
  assert.equal(story.video, true);
  assert.equal(story.base, "https://x.dev");

  const custom = runOptions(["a.ts", "--viewport", "800x600"]);
  assert.deepEqual(custom.viewport, { width: 800, height: 600, scale: 1 });
  assert.equal(custom.preset, undefined);
  assert.equal(custom.mobile, false);
});

test("story and post are a phone's layout that multiplies up to 1080 wide", () => {
  const pixels = (name: keyof typeof PRESETS) => {
    const { viewport, mobile } = runOptions(["a.ts", "--preset", name]);
    return {
      width: viewport.width * viewport.scale,
      height: viewport.height * viewport.scale,
      css: viewport.width,
      mobile,
    };
  };
  assert.deepEqual(pixels("story"), {
    width: 1080,
    height: 1920,
    css: 360,
    mobile: true,
  });
  assert.deepEqual(pixels("post"), {
    width: 1080,
    height: 1350,
    css: 360,
    mobile: true,
  });
  assert.deepEqual(pixels("phone"), {
    width: 390,
    height: 844,
    css: 390,
    mobile: true,
  });
  assert.deepEqual(pixels("desktop"), {
    width: 1280,
    height: 800,
    css: 1280,
    mobile: false,
  });
});

test("the concat list shows each frame until the next arrived, the first from the start", () => {
  assert.equal(
    concatList([300, 400, 1000], 2000),
    "ffconcat version 1.0\nfile 000001.jpg\nduration 0.400\nfile 000002.jpg\nduration 0.600\nfile 000003.jpg\nduration 1.000\nfile 000003.jpg\n"
  );
  assert.throws(() => concatList([], 1000));
  const steady = concatList(
    Array.from({ length: 300 }, (_, k) => (k * 1000) / 30),
    10_000
  );
  const total = [...steady.matchAll(/duration ([\d.]+)/g)].reduce(
    (sum, m) => sum + Number(m[1]),
    0
  );
  assert.equal(Math.round(total * 1000), 10_000);
  const args = recordArgs("out/.frames/list.ffconcat", "out/video.mp4", 10.224);
  assert.deepEqual(args.slice(0, 7), [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "out/.frames/list.ffconcat",
  ]);
  assert.ok(args[args.indexOf("-vf") + 1]!.endsWith("fps=30"));
  assert.equal(args[args.indexOf("-t") + 1], "10.224");
  assert.ok(
    args.includes("libx264") &&
      args.includes("yuv420p") &&
      args.includes("+faststart")
  );
  assert.equal(args.at(-1), "out/video.mp4");
});

test("a caption runs from its step to the next one, and the last to the end", () => {
  const steps = [
    { title: "Pricing", at: 4000 },
    { title: "The landing", at: 500 },
    { title: "a cut", at: 6000, caption: false as const },
    { title: "Sign up", at: 8000 },
    { title: "after the end", at: 12_000 },
  ];
  assert.deepEqual(captionTimeline(steps, 10), [
    { title: "The landing", from: 0.5, to: 4 },
    { title: "Pricing", from: 4, to: 6 },
    { title: "Sign up", from: 8, to: 10 },
  ]);
  assert.deepEqual(captionTimeline([], 10), []);
  assert.equal(captionOptions(["out/run/"]).out, "out/run/video-captioned.mp4");
  assert.throws(() => captionOptions([]), /usage/);
});

test("a long caption wraps, and a word too long for a line shrinks the text", () => {
  assert.deepEqual(wrap("one two three four", 9), ["one two", "three", "four"]);
  assert.deepEqual(wrap("  spaced   out ", 20), ["spaced out"]);

  const story = { width: 1080, height: 1920 };
  const short = captionLayout("Cenník", story);
  assert.equal(short.size, 49);
  assert.deepEqual(short.lines, ["Cenník"]);
  // Low, clear of the middle and of a story's own controls.
  assert.ok(
    short.top > story.height * 0.7 &&
      short.top + short.height === Math.round(story.height * 0.88)
  );

  const long = captionLayout(
    "Every booking lands on the team's board the moment a guest confirms it",
    story
  );
  assert.ok(long.lines.length > 1);
  assert.ok(
    long.lines.every(
      (line) => line.length * 0.6 * long.size <= story.width * 0.9
    )
  );
  assert.equal(long.top + long.height, short.top + short.height);

  const word = captionLayout(
    "Donaudampfschifffahrtsgesellschaftskapitänsmütze",
    story
  );
  assert.ok(word.size < 49 && word.lines.length === 1);

  const desktop = captionLayout("Pricing", { width: 1280, height: 800 });
  assert.equal(desktop.top + desktop.height, 800);
});

test("caption text survives ffmpeg's two rounds of unescaping", () => {
  assert.equal(filterValue("plain text"), "plain text");
  assert.equal(filterValue("a:b"), "a\\\\:b");
  assert.equal(filterValue("it's"), "it\\\\\\'s");
  assert.equal(filterValue("a\\b"), "a\\\\\\\\b");
  assert.equal(filterValue("[a], b; 50%"), "\\[a\\]\\, b\\; 50%");

  const filter = captionFilter(
    [{ title: "Step 1: it's on", from: 0.5, to: 4 }],
    { width: 1280, height: 800 },
    "/f/Sans.ttf"
  );
  assert.match(
    filter,
    /^drawbox=x=0:y=\d+:w=iw:h=\d+:color=black:t=fill:enable=between\(t\\,0\.500\\,4\.000\)/
  );
  assert.match(
    filter,
    /drawtext=fontfile=\/f\/Sans\.ttf:text=Step 1\\\\: it\\\\\\'s on:expansion=none:fontsize=36:fontcolor=white/
  );
  // Nothing unescaped is left to end the filter early: the band, its two rules, one line.
  assert.equal(filter.split(/(?<!\\),/).length, 4);
});

test("run flags refuse what they cannot use", () => {
  assert.throws(() => runOptions([]), /usage/);
  assert.throws(
    () => runOptions(["a.ts", "--preset", "tablet"]),
    /one of desktop/
  );
  assert.throws(() => runOptions(["a.ts", "--viewport", "wide"]), /WxH/);
  assert.throws(
    () => runOptions(["a.ts", "--preset", "phone", "--viewport", "1x1"]),
    /exclude/
  );
  assert.throws(() => runOptions(["a.ts", "--slow", "soon"]), /number/);
  assert.throws(() => runOptions(["a.ts", "--vidoe"]));
  assert.throws(
    () => runOptions(["a.ts", "--video", "--pointer", "--cursor"]),
    /both draw/
  );
  assert.throws(() => runOptions(["a.ts", "--pointer"]), /needs --video/);
  assert.throws(
    () => runOptions(["a.ts", "--frame-by-frame"]),
    /needs --video/
  );
  assert.throws(
    () => runOptions(["a.ts", "--video", "--frame-by-frame", "--slow", "100"]),
    /wall-clock/
  );
});

test("--mask turns on the defaults and --mask-selector adds to them", () => {
  assert.equal(runOptions(["a.ts"]).mask, undefined);
  assert.deepEqual(runOptions(["a.ts", "--mask"]).mask, []);
  assert.deepEqual(
    runOptions([
      "a.ts",
      "--mask-selector",
      "input[name=name]",
      "--mask-selector",
      ".card",
    ]).mask,
    ["input[name=name]", ".card"]
  );
});

test("clip builds an mp4 trim and a palette GIF", () => {
  const mp4 = clipOptions([
    "out/video.mp4",
    "--from",
    "1",
    "--to",
    "3.5",
    "--speed",
    "2",
    "--width",
    "720",
  ]);
  assert.equal(mp4.out, "out/video-clip.mp4");
  const args = clipArgs(mp4);
  assert.deepEqual(args.slice(0, 7), [
    "-y",
    "-ss",
    "1",
    "-to",
    "3.5",
    "-i",
    "out/video.mp4",
  ]);
  assert.equal(args[args.indexOf("-vf") + 1], "setpts=PTS/2,scale=720:-2");
  assert.ok(args.includes("yuv420p") && args.includes("+faststart"));
  assert.ok(args.includes("-an"));
  assert.ok(clipArgs(clipOptions(["out/video.mp4"])).includes("aac"));

  const gif = clipOptions(["out/video.mp4", "--gif"]);
  assert.equal(gif.out, "out/video.gif");
  assert.match(
    clipArgs(gif).join(" "),
    /fps=12,scale=640:-1:flags=lanczos,split.*palettegen.*paletteuse/
  );
});

const manifest: Manifest = {
  id: "20261002-134501-landing",
  project: "heystol",
  title: "New landing",
  scenario: "landing.ts",
  base: "https://heystol.com",
  viewport: { width: 1280, height: 800, scale: 1 },
  dark: false,
  steps: [],
  createdAt: "2026-10-02T13:45:01.000Z",
  files: [
    {
      name: "01-top.png",
      contentType: "image/png",
      bytes: 1,
      url: "https://b/01-top.png",
    },
    {
      name: "video.mp4",
      contentType: "video/mp4",
      bytes: 2,
      duration: 4.25,
      url: "https://b/video.mp4",
    },
    {
      name: "video.gif",
      contentType: "image/gif",
      bytes: 3,
      url: "https://b/video.gif",
    },
  ],
};

test("the Markdown block embeds images and links the video", () => {
  assert.equal(
    markdown(manifest),
    "**New landing**\n\n![01-top](https://b/01-top.png)\n\n![video](https://b/video.gif)\n\n[video.mp4, 4.3s](https://b/video.mp4)"
  );
});

test("the index holds the stored runs only, newest first, the latest entry winning", () => {
  const entry = indexEntry(manifest, "https://b/manifest.json");
  assert.equal(entry.cover, "https://b/01-top.png");
  assert.equal(entry.files, 3);

  const older: IndexEntry = {
    ...entry,
    id: "old",
    createdAt: "2026-09-01T00:00:00.000Z",
  };
  const newer: IndexEntry = {
    ...entry,
    id: "new",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
  const deleted: IndexEntry = { ...entry, id: "deleted" };
  const stale = [older, deleted, entry];

  const built = buildIndex(
    ["old", "new", entry.id, "unknown"],
    [...stale, newer, { ...entry, title: "Renamed" }]
  );
  assert.deepEqual(
    built.index.map((e) => e.id),
    ["new", entry.id, "old"]
  );
  assert.equal(built.index[1]?.title, "Renamed");
  assert.deepEqual(built.missing, ["unknown"]);
});

test("measure reads the last frame count ffmpeg printed and reports against the recording", () => {
  assert.equal(
    framesKept(
      "frame=   12 fps=0.0 q=-0.0 size=N/A\rframe=  271 fps=260 q=-0.0 Lsize=N/A time=00:00:10.00"
    ),
    271
  );
  assert.throws(() => framesKept("nothing"));
  const run = {
    steps: [
      { title: "a", at: 0 },
      { title: "b", at: 6400 },
    ],
    recording: { seconds: 9.98, repaints: 181 },
  } as Run;
  assert.deepEqual(measureLines(run, 10, 271), [
    "27.1 distinct frames/s (271 of 300 at 30 fps)",
    "10.00s video",
    "+20 ms against the 9.98s recorded",
    "18.1 repaints/s from Chromium (181)",
    "2 steps, last at 6.40s",
  ]);
});

test("the pointer glides on an arc from where it is to the target, longer for farther, never past the ceiling", () => {
  assert.deepEqual(glidePath({ x: 10, y: 10 }, { x: 11, y: 10 }), []);
  const path = glidePath({ x: 0, y: 0 }, { x: 300, y: 0 });
  assert.deepEqual(path[0], [0, 0, 0]);
  assert.deepEqual(path.at(-1), [glideMs(300), 300, 0]);
  assert.ok(
    path.every(([at], i) => i === 0 || at > path[i - 1]![0]),
    "time only goes forward"
  );
  assert.ok(
    path.some(([, , y]) => y > 20),
    "an arc, not a straight line"
  );
  const step = (i: number) =>
    Math.hypot(path[i + 1]![1] - path[i]![1], path[i + 1]![2] - path[i]![2]);
  const middle = Math.floor(path.length / 2);
  assert.ok(
    step(0) < step(middle) / 4 && step(path.length - 2) < step(middle) / 4
  );
  assert.equal(glideMs(0), 250);
  assert.ok(glideMs(300) > glideMs(100));
  assert.equal(glideMs(5000), 900);
});

test("polish places the pointer's corner on each frame it moves, in video pixels, and the ring fades as it grows", () => {
  const moves: [number, number, number][] = [
    [500, 100, 200],
    [520, 110, 200],
    [540, 120, 200],
    [2000, 50, 60],
  ];
  const track = pointerTrack(moves, 3, 3, { x: 20, y: 20 })!;
  assert.equal(track.from, 0.5);
  assert.deepEqual(track.start, { x: 240, y: 540 });
  // Frame 15 is at 500 ms, frame 16 at 533 ms, where the 520 ms point is the latest; 540 ms falls in frame 17.
  assert.deepEqual(track.commands, [
    "0.4833 overlay@pointer x 240, overlay@pointer y 540;",
    "0.5167 overlay@pointer x 270, overlay@pointer y 540;",
    "0.5500 overlay@pointer x 300, overlay@pointer y 540;",
    "1.9833 overlay@pointer x 90, overlay@pointer y 120;",
  ]);
  assert.equal(pointerTrack([], 3, 1, { x: 0, y: 0 }), undefined);

  // A press: the wave fades out over 450 ms, and the arrow is in the first six frames only.
  const presses = clickFrames();
  assert.equal(presses.length, 14);
  assert.match(presses[0]!.svg, /stroke-opacity="1\.000"/);
  assert.match(presses.at(-1)!.svg, /stroke-opacity="0\.000"/);
  assert.deepEqual(
    presses.map((p) => p.svg.includes("<path")),
    [...Array(6).fill(true), ...Array(8).fill(false)]
  );
});

test("the camera closes in before a click, pans only to a click outside the middle, and pulls back after a pause", () => {
  const size = { width: 1280, height: 800, scale: 1, seconds: 30 };
  // One click near the top-left corner: the view stays inside the frame.
  const one = zoomTrack([[4000, 10, 10]], [], size, 2);
  assert.deepEqual(one.keys, [
    { t: 3.4, z: 1, x: 640, y: 400 },
    { t: 3.9, z: 2, x: 320, y: 200 },
    { t: 5.2, z: 2, x: 320, y: 200 },
    { t: 5.8, z: 1, x: 640, y: 400 },
  ]);
  assert.deepEqual(one.spans, [[3.4, 5.8]]);

  // Close in time: one zoom. The second click sits in the middle of the view, the third does not.
  const near = zoomTrack(
    [
      [4000, 640, 400],
      [6000, 700, 420],
      [8000, 1200, 700],
    ],
    [],
    size,
    2
  );
  assert.equal(near.spans.length, 1);
  assert.deepEqual(
    near.keys.map((k) => [k.t, k.x, k.y]),
    [
      [3.4, 640, 400],
      [3.9, 640, 400],
      [7.3, 640, 400],
      [7.9, 960, 600],
      [9.2, 960, 600],
      [9.8, 640, 400],
    ]
  );

  // Far apart in time: two zooms. A step marked zoom: false drops its clicks.
  assert.equal(
    zoomTrack(
      [
        [2000, 640, 400],
        [9000, 640, 400],
      ],
      [],
      size,
      2
    ).spans.length,
    2
  );
  const steps = [
    { title: "a", at: 0 },
    { title: "b", at: 8000, zoom: false as const },
  ];
  assert.equal(
    zoomTrack(
      [
        [2000, 640, 400],
        [9000, 640, 400],
      ],
      steps,
      size,
      2
    ).spans.length,
    1
  );

  assert.throws(
    () => polishOptions(["out/x", "--zoom-factor", "0.5"]),
    /above 1/
  );
});

test("a label says its step's words beside the pointer, flips at the right edge and stays out of a story's safe zones", () => {
  assert.equal(labelText("  Vybrať   čas "), "Vybrať čas");
  assert.equal(labelText("x".repeat(40)), `${"x".repeat(31)}…`);

  const steps = [
    { title: "Úvod", at: 0 },
    { title: "skryté", at: 2000, caption: false as const },
    { title: "Čas", at: 3000 },
    { title: "Koniec", at: 9800 },
  ];
  assert.deepEqual(labelWindows(steps, 10, 1), [
    { text: "Úvod", from: 1, to: 2 },
    { text: "Čas", from: 3, to: 7 },
  ]);

  const pill = { width: 100, height: 26 };
  const desk = { width: 1280, height: 800 };
  assert.deepEqual(labelPlace({ x: 400, y: 300 }, pill, desk), {
    x: 414,
    y: 320,
  });
  assert.deepEqual(labelPlace({ x: 1200, y: 300 }, pill, desk), {
    x: 1086,
    y: 320,
  });
  assert.deepEqual(labelPlace({ x: 400, y: 790 }, pill, desk), {
    x: 414,
    y: 766,
  });
  const story = { width: 360, height: 640 };
  assert.deepEqual(
    labelPlace({ x: 100, y: 630 }, pill, story, {
      top: 250 / 3,
      bottom: 340 / 3,
    }),
    { x: 114, y: 640 - 340 / 3 - 8 - 26 }
  );
});

test("the frame centres the recording with a margin, inside a story's safe zones, on the background asked for", () => {
  assert.deepEqual(frameLayout({ width: 1280, height: 800 }), {
    width: 1100,
    height: 688,
    x: 90,
    y: 56,
    radius: 20,
  });
  // A story is a large card too, reaching into the zones its feed covers.
  assert.deepEqual(frameLayout({ width: 1080, height: 1920 }), {
    width: 928,
    height: 1652,
    x: 76,
    y: 134,
    radius: 27,
  });

  assert.deepEqual(backgroundColors(undefined), ["#E4DDFF", "#C9DCFF"]);
  assert.deepEqual(backgroundColors("#000"), ["#000"]);
  assert.deepEqual(backgroundColors("#112233, #445566"), [
    "#112233",
    "#445566",
  ]);
  assert.throws(() => backgroundColors("red"), /#rrggbb/);
  assert.deepEqual(
    polishOptions(["out/x", "--background", "#000"]).background,
    ["#000"]
  );
});

test("polish draws labels always, and a zoom and a frame on a landscape video unless told otherwise", () => {
  const desk = { width: 1280, height: 800 };
  const story = { width: 1080, height: 1920 };
  const plan = (
    args: string[],
    size: { width: number; height: number },
    preset?: string
  ) => polishPlan(polishOptions(["out/x", ...args]), size, preset);
  assert.deepEqual(plan([], desk), {
    labels: true,
    zoom: 1.5,
    frame: ["#E4DDFF", "#C9DCFF"],
  });
  assert.deepEqual(plan([], story), {
    labels: true,
    zoom: undefined,
    frame: undefined,
  });
  assert.deepEqual(plan([], story, "story"), {
    labels: true,
    zoom: undefined,
    frame: ["#E4DDFF", "#C9DCFF"],
  });
  assert.deepEqual(
    plan(["--no-zoom", "--no-labels", "--zoom-factor", "2"], desk),
    { labels: false, zoom: undefined, frame: ["#E4DDFF", "#C9DCFF"] }
  );
  assert.deepEqual(
    plan(["--zoom", "--zoom-factor", "1.2", "--background", "#000"], story),
    { labels: true, zoom: 1.2, frame: ["#000"] }
  );
  assert.deepEqual(
    plan(["--no-frame", "--background", "#000"], desk).frame,
    undefined
  );
});

// The vectors are the examples in the AWS S3 API Reference, "Signature Calculations for the
// Authorization Header: Transferring Payload in a Single Chunk (AWS Signature Version 4)":
// GET Object, PUT Object and GET Bucket (List Objects).
test("SigV4 signs the S3 documentation's GET Object, PUT Object and List Objects examples", () => {
  const key = {
    id: "AKIAIOSFODNN7EXAMPLE",
    secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    service: "s3",
  };
  const date = "20130524T000000Z";
  const empty = sha256("");
  assert.equal(
    empty,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  );
  const credential =
    "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request";

  const host = "examplebucket.s3.amazonaws.com";
  const get = {
    method: "GET",
    path: "/test.txt",
    query: {},
    headers: {
      host,
      range: "bytes=0-9",
      "x-amz-content-sha256": empty,
      "x-amz-date": date,
    },
    payloadHash: empty,
  };
  assert.equal(
    canonicalRequest(get),
    `GET\n/test.txt\n\nhost:${host}\nrange:bytes=0-9\nx-amz-content-sha256:${empty}\nx-amz-date:${date}\n\n` +
      `host;range;x-amz-content-sha256;x-amz-date\n${empty}`
  );
  assert.equal(
    sha256(canonicalRequest(get)),
    "7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972"
  );
  assert.equal(
    authorization(get, key, date),
    `${credential}, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ` +
      "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
  );

  const body = sha256("Welcome to Amazon S3.");
  assert.equal(
    body,
    "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072"
  );
  const put = {
    method: "PUT",
    path: `/${keyPath("test$file.text")}`,
    query: {},
    headers: {
      date: "Fri, 24 May 2013 00:00:00 GMT",
      host,
      "x-amz-content-sha256": body,
      "x-amz-date": date,
      "x-amz-storage-class": "REDUCED_REDUNDANCY",
    },
    payloadHash: body,
  };
  assert.equal(put.path, "/test%24file.text");
  assert.equal(
    authorization(put, key, date),
    `${credential}, SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class, ` +
      "Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd"
  );

  const list = {
    method: "GET",
    path: "/",
    query: { prefix: "J", "max-keys": "2" },
    headers: { host, "x-amz-content-sha256": empty, "x-amz-date": date },
    payloadHash: empty,
  };
  assert.equal(canonicalRequest(list).split("\n")[2], "max-keys=2&prefix=J");
  assert.equal(
    authorization(list, key, date),
    `${credential}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, ` +
      "Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7"
  );
});

test("the query and a key's path are encoded as SigV4 signs them", () => {
  // What a listing sends. A continuation token is opaque and may hold `+`, `/` and `=`.
  assert.equal(
    canonicalQuery({
      "list-type": "2",
      prefix: "heystol/",
      delimiter: "/",
      "continuation-token": "a+b/c= d",
    }),
    "continuation-token=a%2Bb%2Fc%3D%20d&delimiter=%2F&list-type=2&prefix=heystol%2F"
  );
  assert.equal(canonicalQuery({}), "");
  // From the aws-sig-v4-test-suite: get-vanilla-query-order-key-case, -query-unreserved, -utf8-query.
  assert.equal(
    canonicalQuery({ Param2: "value2", Param1: "value1" }),
    "Param1=value1&Param2=value2"
  );
  const unreserved =
    "-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  assert.equal(
    canonicalQuery({ [unreserved]: unreserved }),
    `${unreserved}=${unreserved}`
  );
  assert.equal(canonicalQuery({ "\u1234": "bar" }), "%E1%88%B4=bar");
  // encodeURIComponent leaves these alone; SigV4 does not.
  assert.equal(uriEncode("!'()*"), "%21%27%28%29%2A");
  assert.equal(
    keyPath("heystol/20261002-134501-landing/01 top.png"),
    "heystol/20261002-134501-landing/01%20top.png"
  );
});

test("a ListObjectsV2 page gives its keys, its folders and the token for the next page", () => {
  const first = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>media</Name>
  <Prefix>heystol/</Prefix>
  <Delimiter>/</Delimiter>
  <MaxKeys>1000</MaxKeys>
  <KeyCount>3</KeyCount>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>1ueGcxLPRx1Tr/XYExHnhbYLgveDs2J/wm36Hy4vbOwM=</NextContinuationToken>
  <Contents>
    <Key>heystol/index.json</Key>
    <LastModified>2026-10-08T12:00:00.000Z</LastModified>
    <ETag>&quot;9b2cf535f27731c974343645a3985328&quot;</ETag>
    <Size>812</Size>
    <StorageClass>STANDARD</StorageClass>
  </Contents>
  <CommonPrefixes>
    <Prefix>heystol/20261002-134501-landing/</Prefix>
  </CommonPrefixes>
  <CommonPrefixes>
    <Prefix>heystol/20261008-090000-booking/</Prefix>
  </CommonPrefixes>
</ListBucketResult>`;
  assert.deepEqual(parseListing(first), {
    keys: ["heystol/index.json"],
    prefixes: [
      "heystol/20261002-134501-landing/",
      "heystol/20261008-090000-booking/",
    ],
    next: "1ueGcxLPRx1Tr/XYExHnhbYLgveDs2J/wm36Hy4vbOwM=",
  });

  const last =
    '<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
    "<Name>media</Name><Prefix>heystol/20261002-134501-landing/</Prefix><KeyCount>2</KeyCount><MaxKeys>1000</MaxKeys>" +
    "<IsTruncated>false</IsTruncated>" +
    "<Contents><Key>heystol/20261002-134501-landing/01-top.png</Key><Size>1</Size></Contents>" +
    "<Contents><Key>heystol/20261002-134501-landing/before &amp; after &lt;1&gt;.png</Key><Size>2</Size></Contents>" +
    "</ListBucketResult>";
  assert.deepEqual(parseListing(last), {
    keys: [
      "heystol/20261002-134501-landing/01-top.png",
      "heystol/20261002-134501-landing/before & after <1>.png",
    ],
    prefixes: [],
    next: undefined,
  });
});

test("init flags: defaults, agents by comma or repeat, none", () => {
  assert.deepEqual(initOptions([]), {
    yes: false,
    agents: undefined,
    base: undefined,
    scenario: true,
  });
  const o = initOptions([
    "-y",
    "--agent",
    "claude,cursor",
    "--agent",
    "agents",
    "--base",
    "http://localhost:4000/",
    "--no-scenario",
  ]);
  assert.deepEqual(o, {
    yes: true,
    agents: ["claude", "cursor", "agents"],
    base: "http://localhost:4000",
    scenario: false,
  });
  assert.deepEqual(initOptions(["--agent", "none"]).agents, []);
  assert.throws(() => initOptions(["--agent", "copilot"]), /--agent is one of/);
  assert.throws(() => initOptions(["extra"]), /usage/);
});

test("init detects agents by the files at the root", () => {
  assert.deepEqual(detectAgents(["CLAUDE.md", "AGENTS.md", "src"]), [
    "claude",
    "agents",
  ]);
  assert.deepEqual(detectAgents([".cursor"]), ["cursor"]);
  assert.deepEqual(detectAgents(["package.json"]), []);
});

test("init finds the dev server's port", () => {
  assert.deepEqual(devServer({}), {
    url: "http://localhost:3000",
    framework: undefined,
  });
  assert.deepEqual(devServer({ devDependencies: { vite: "7" } }), {
    url: "http://localhost:5173",
    framework: "vite",
  });
  assert.equal(
    devServer({
      dependencies: { next: "16" },
      scripts: { dev: "next dev --port 3005" },
    }).url,
    "http://localhost:3005"
  );
  assert.equal(
    devServer({ scripts: { dev: "PORT=8080 node server.js" } }).url,
    "http://localhost:8080"
  );
  assert.equal(
    devServer({ dependencies: { astro: "5" } }).url,
    "http://localhost:4321"
  );
});

test("init names an ffmpeg with librsvg for each system", () => {
  assert.equal(
    ffmpegInstall("linux", "ID=ubuntu\nID_LIKE=debian\n"),
    "sudo apt-get install -y ffmpeg"
  );
  assert.equal(
    ffmpegInstall("linux", 'ID="linuxmint"\nID_LIKE="ubuntu debian"\n'),
    "sudo apt-get install -y ffmpeg"
  );
  assert.equal(
    ffmpegInstall("linux", "ID=arch\n"),
    "sudo pacman -S --needed ffmpeg"
  );
  assert.match(ffmpegInstall("darwin"), /^brew tap homebrew-ffmpeg/);
  assert.match(ffmpegInstall("darwin", "", true), /^brew uninstall ffmpeg && /);
  assert.match(ffmpegInstall("linux", "ID=nixos\n"), /package manager/);
});

test("a line longer than its step holds the step's last frame until the line ends", () => {
  const segments = narrationSegments(
    [
      { title: "a", at: 1000, say: "Prvá" },
      { title: "b", at: 3000 },
      { title: "c", at: 4000, say: "Tretia" },
    ],
    6
  );
  assert.deepEqual(segments, [
    { from: 0, to: 1 },
    { from: 1, to: 3, say: "Prvá" },
    { from: 3, to: 4 },
    { from: 4, to: 6, say: "Tretia" },
  ]);
  // 0.3 lead + 2.5 + 0.6 tail = 3.4 s against a 2 s step: held 1.4 s. 1 s fits in the last.
  const plan = narrationPlan(segments, [2.5, 1]);
  assert.equal(plan.seconds, 1 + 3.4 + 1 + 2);
  assert.deepEqual(plan.holds, [0, 1.4, 0, 0]);
  assert.match(
    plan.audio,
    /^anullsrc[^;]*\[a0\];\[0:a\][^;]*\[a1\];anullsrc[^;]*\[a2\];\[1:a\][^;]*\[a3\];/
  );
  assert.match(plan.audio, /concat=n=4:v=0:a=1\[a\]$/);
  assert.equal(
    plan.srt,
    "1\n00:00:01,300 --> 00:00:03,800\nPrvá\n\n2\n00:00:05,700 --> 00:00:06,700\nTretia\n"
  );
});
