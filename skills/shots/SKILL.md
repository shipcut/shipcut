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
- `step(title)` marks a chapter for later captions. Write it as a caption.
- Wait for the thing you are about to shoot (`waitFor`, `waitForLoadState`),
  not for a timeout. A fixed pause is right only to let a video breathe.
- Node runs the file directly: plain imports only, no path aliases, no `enum`.
- Never write to production. A scenario against a live site only reads.

## Record

```sh
shots run shots/landing.ts --base http://localhost:3000 --video --cursor
```

`--preset desktop|phone|post|story` (1280x800, 390x844, 1080x1350, 1080x1920)
or `--viewport WxH`. `--scale 2` for sharp shots. `--slow 150` when the video
moves too fast to follow. `--storage-state FILE` to start signed in.
`--locale sk`, `--dark`.

Files land in `./out/<run-id>/` with a `run.json`; the command prints the
paths. Look at the PNGs before publishing. If the scenario throws, read
`failed.png` in the same directory.

The command queues itself through `heavy` on a shared box. Do not wrap it.
Exit 75 means the box is busy. Retry later.

## Clip

```sh
shots clip out/<run-id>/video.mp4 --from 1 --to 8 --speed 1.5
shots clip out/<run-id>/video.mp4 --gif --width 480
```

Do this before publishing: a clip made inside the run directory is uploaded
with it. An mp4 is only ever a link in Markdown; a GIF shows inline.

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
