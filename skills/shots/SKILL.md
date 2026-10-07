---
name: shots
description: Record screenshots and a short video of this project's web app with the `shots` CLI and publish them to get links for a changelog entry or a PR. Use when a UI change should be shown before and after, when a PR needs proof of a flow, or for /shots.
---

# shots

`shots` drives a scenario in headless Chromium, saves PNGs and an mp4, and
uploads them to a public Blob store. You get Markdown with the links.

## When to record

- A visible change: record the same scenario before (on the base branch or
  production) and after, and paste both.
- A new flow: one run with `--video --cursor`.
- Not for verification. Asserting that a flow works is the project's verify
  skill; this is for showing it.

## The scenario

An ES module in this project (keep them in one directory, e.g. `shots/`):

```ts
export default async ({ page, base, shot, step }) => {
  step("The landing");
  await page.goto(`${base}/`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot("landing");
};
```

- `page` is a Playwright page, `base` is `--base` with no trailing slash.
- `shot(name)` saves `NN-name.png` of the viewport; `shot(name, { fullPage: true })` the whole page.
- `step(title)` marks a chapter, and `shots caption` burns the title into the
  video until the next step. Write it as a caption: a few words, no full stop.
  `step(title, { caption: false })` marks a chapter that shows none.
- Wait for the thing you are about to shoot (`waitFor`, `waitForLoadState`),
  not for a timeout. A fixed pause is right only to let a video breathe.
- Node runs the file directly: plain imports only, no path aliases, no `enum`.
- Never write to production. A scenario against a live site only reads.

## Record

```sh
shots run shots/landing.ts --base http://localhost:3000 --video --cursor
```

| Preset | Layout | Shots and video |
|---|---|---|
| `desktop` (default) | desktop, 1280x800 CSS | 1280x800 |
| `phone` | phone, 390x844 CSS | 390x844 |
| `post` | phone, 360x450 CSS at scale 3 | 1080x1350 |
| `story` | phone, 360x640 CSS at scale 3 | 1080x1920 |

`post` and `story` are for social feeds, and show the phone layout. For
anything else, `--viewport WxH` takes CSS pixels and behaves as a desktop, and
`--scale N` multiplies shots and video alike, so `--scale 2` on `desktop` is a
2560x1600 video.

`--slow 150` when the video moves too fast to follow. `--storage-state FILE`
to start signed in. `--locale sk`, `--dark`.

The video is H.264 at 30 fps and shows the one page the scenario was given.
It is encoded after the browser closes, so the command ends about as long
again after the scenario does, and `<out>/.frames/` holds the raw frames
until then.
`--cursor` draws the pointer from its first move, so a scenario that only
scrolls shows none. A scroll done with `scrollIntoView({ behavior: "smooth" })`
and a pause after it reads better than a jump.

Files land in `./out/<run-id>/` with a `run.json`; the command prints the
paths. Look at the PNGs before publishing. If the scenario throws, read
`failed.png` in the same directory.

`run`, `clip` and `caption` queue themselves through `heavy` on a shared box.
Do not wrap them. Exit 75 means the box is busy. Retry later.

## Caption

```sh
shots caption out/<run-id>
```

Writes `video-captioned.mp4` beside `video.mp4`, each step's title on a black
band low in the frame from that step until the next. Pull a frame from inside
each step and look at it before publishing:

```sh
ffmpeg -v error -ss 4 -i out/<run-id>/video-captioned.mp4 -frames:v 1 /tmp/frame.png
```

Caption first, then clip the captioned file if it needs trimming.

## Clip

```sh
shots clip out/<run-id>/video.mp4 --from 1 --to 8 --speed 1.5
shots clip out/<run-id>/video.mp4 --gif --width 480
```

Do this before publishing: a clip or a captioned video made inside the run
directory is uploaded with it. An mp4 is only ever a link in Markdown; a GIF shows inline.

## Publish

```sh
shots publish out/<run-id> --project <this project's name> --title "What changed"
```

The project name is lowercase with dashes and stays the same for every run of
this project. Stdout is the Markdown block. Paste it as printed into the PR
description or the changelog entry; for before and after, put the two blocks
under "Before" and "After".

`shots list --project <name>` shows what is stored.
`shots rm <project>/<run-id> --yes` removes a run you published by mistake.
Remove only runs you made.
