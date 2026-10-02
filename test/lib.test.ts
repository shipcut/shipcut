import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildIndex,
  clipArgs,
  clipOptions,
  framesDue,
  indexEntry,
  markdown,
  PRESETS,
  recordArgs,
  runId,
  runOptions,
} from "../src/lib.ts";
import type { IndexEntry, Manifest } from "../src/types.ts";

test("a run id is the UTC second and the scenario's file name", () => {
  assert.equal(runId(new Date("2026-10-02T13:45:01.999Z"), "flows/Book a Table.ts"), "20261002-134501-book-a-table");
  assert.equal(runId(new Date("2026-01-05T03:04:05Z"), "---.mjs"), "20260105-030405-run");
});

test("run flags resolve to a viewport", () => {
  const plain = runOptions(["a.ts"]);
  assert.deepEqual(plain.viewport, { width: 1280, height: 800, scale: 1 });
  assert.equal(plain.preset, "desktop");
  assert.equal(plain.base, "http://localhost:3000");

  const story = runOptions(["a.ts", "--preset", "story", "--scale", "2", "--video", "--base", "https://x.dev/"]);
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
    return { width: viewport.width * viewport.scale, height: viewport.height * viewport.scale, css: viewport.width, mobile };
  };
  assert.deepEqual(pixels("story"), { width: 1080, height: 1920, css: 360, mobile: true });
  assert.deepEqual(pixels("post"), { width: 1080, height: 1350, css: 360, mobile: true });
  assert.deepEqual(pixels("phone"), { width: 390, height: 844, css: 390, mobile: true });
  assert.deepEqual(pixels("desktop"), { width: 1280, height: 800, css: 1280, mobile: false });
});

test("the recorder repeats the frame on screen until the wall clock is covered", () => {
  assert.equal(framesDue(0, 0), 0);
  assert.equal(framesDue(1000, 0), 30);
  assert.equal(framesDue(1000, 29), 1);
  // Two repaints inside one thirtieth of a second: the later one replaces the earlier.
  assert.equal(framesDue(1010, 30), 0);
  assert.equal(framesDue(10_000, 0, 25), 250);
  const args = recordArgs("out/video.mp4");
  assert.deepEqual(args.slice(0, 9), ["-y", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-"]);
  assert.ok(args.includes("libx264") && args.includes("yuv420p") && args.includes("+faststart"));
  assert.equal(args.at(-1), "out/video.mp4");
});

test("run flags refuse what they cannot use", () => {
  assert.throws(() => runOptions([]), /usage/);
  assert.throws(() => runOptions(["a.ts", "--preset", "tablet"]), /one of desktop/);
  assert.throws(() => runOptions(["a.ts", "--viewport", "wide"]), /WxH/);
  assert.throws(() => runOptions(["a.ts", "--preset", "phone", "--viewport", "1x1"]), /exclude/);
  assert.throws(() => runOptions(["a.ts", "--slow", "soon"]), /number/);
  assert.throws(() => runOptions(["a.ts", "--vidoe"]));
});

test("clip builds an mp4 trim and a palette GIF", () => {
  const mp4 = clipOptions(["out/video.mp4", "--from", "1", "--to", "3.5", "--speed", "2", "--width", "720"]);
  assert.equal(mp4.out, "out/video-clip.mp4");
  const args = clipArgs(mp4);
  assert.deepEqual(args.slice(0, 7), ["-y", "-ss", "1", "-to", "3.5", "-i", "out/video.mp4"]);
  assert.equal(args[args.indexOf("-vf") + 1], "setpts=PTS/2,scale=720:-2");
  assert.ok(args.includes("yuv420p") && args.includes("+faststart"));

  const gif = clipOptions(["out/video.mp4", "--gif"]);
  assert.equal(gif.out, "out/video.gif");
  assert.match(clipArgs(gif).join(" "), /fps=12,scale=640:-1:flags=lanczos,split.*palettegen.*paletteuse/);
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
    { name: "01-top.png", contentType: "image/png", bytes: 1, url: "https://b/01-top.png" },
    { name: "video.mp4", contentType: "video/mp4", bytes: 2, duration: 4.25, url: "https://b/video.mp4" },
    { name: "video.gif", contentType: "image/gif", bytes: 3, url: "https://b/video.gif" },
  ],
};

test("the Markdown block embeds images and links the video", () => {
  assert.equal(
    markdown(manifest),
    "**New landing**\n\n![01-top](https://b/01-top.png)\n\n![video](https://b/video.gif)\n\n[video.mp4, 4.3s](https://b/video.mp4)",
  );
});

test("the index holds the stored runs only, newest first, the latest entry winning", () => {
  const entry = indexEntry(manifest, "https://b/manifest.json");
  assert.equal(entry.cover, "https://b/01-top.png");
  assert.equal(entry.files, 3);

  const older: IndexEntry = { ...entry, id: "old", createdAt: "2026-09-01T00:00:00.000Z" };
  const newer: IndexEntry = { ...entry, id: "new", createdAt: "2026-11-01T00:00:00.000Z" };
  const deleted: IndexEntry = { ...entry, id: "deleted" };
  const stale = [older, deleted, entry];

  const built = buildIndex(["old", "new", entry.id, "unknown"], [...stale, newer, { ...entry, title: "Renamed" }]);
  assert.deepEqual(built.index.map((e) => e.id), ["new", entry.id, "old"]);
  assert.equal(built.index[1]?.title, "Renamed");
  assert.deepEqual(built.missing, ["unknown"]);
});
