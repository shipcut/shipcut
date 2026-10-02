# shots

Screenshots and short videos of an app's real flows, recorded in headless
Chromium and published to Vercel Blob with a manifest. A changelog entry or a
PR pastes the links; later a web UI lists what was saved.

Scenarios live in the project they record. `shots` only records, clips and
publishes.

## Install

Node 24 runs the TypeScript as is, so there is no build.

```sh
pnpm install
ln -s "$PWD/bin/shots" ~/.local/bin/shots
```

It needs `ffmpeg` and `ffprobe` on PATH, and Playwright's Chromium
(`pnpm exec playwright install chromium` where it is missing).

Publishing needs `BLOB_READ_WRITE_TOKEN`, from the environment or else from
`~/.config/shots/env` (a `KEY=value` file; a link to this repo's `.env.local`
works).

## Commands

### run

```sh
shots run flows/booking.ts --base http://localhost:3000 --video --cursor
```

A scenario is an ES module (`.ts` or `.mjs`) with a default export:

```ts
export default async ({ page, base, shot, step }) => {
  step("The landing");
  await page.goto(`${base}/`);
  await shot("landing"); // 01-landing.png
  step("Booking a table");
  await page.getByRole("link", { name: "Book" }).click();
  await shot("form", { fullPage: true }); // 02-form.png
};
```

`page` is a Playwright page. `step(title)` marks a chapter; its title and time
offset are kept for captions. Type it with
`import type { Scenario } from "<this repo>/src/run.ts"` if you want the types.

| Flag | |
|---|---|
| `--base URL` | handed to the scenario, default `http://localhost:3000` |
| `--out DIR` | default `./out/<run-id>/` |
| `--preset` | `desktop` 1280x800 (default), `phone` 390x844 (touch, mobile), `post` 1080x1350, `story` 1080x1920 |
| `--viewport WxH` | instead of a preset |
| `--scale N` | device pixel ratio for the shots; the video stays at viewport size |
| `--video` | records the run as `video.mp4` (H.264, yuv420p, faststart) |
| `--cursor` | draws a pointer and click rings in the video; shots stay clean |
| `--slow MS` | pause between browser actions, so a video can be followed |
| `--storage-state FILE` | a Playwright storage state, to start signed in |
| `--locale xx`, `--dark` | browser locale, dark colour scheme |

The run directory gets the files and a `run.json`. A scenario that throws
leaves `failed.png` and exits 1.

Where `heavy` is on PATH the command runs itself again under
`heavy --name shots --no-lock --mem 1500M --need 800`, so the browser and
ffmpeg share one memory cap. Exit 75 means the box had no memory to spare.

### clip

```sh
shots clip out/20261002-134501-booking/video.mp4 --from 2 --to 9 --speed 1.5
shots clip out/20261002-134501-booking/video.mp4 --gif --width 480
```

Trims (`--from`, `--to` in seconds of the source), speeds up, scales, or makes
a palette GIF (12 fps, 640 wide unless `--width`). Writes `<name>-clip.mp4` or
`<name>.gif` next to the source unless `--out`. A result inside a run
directory is added to its `run.json`, so `publish` uploads it.

### publish

```sh
shots publish out/20261002-134501-booking --project heystol --title "Booking, new form"
```

Uploads the run and prints Markdown on stdout: images embedded, videos linked.
No Markdown host plays an outside mp4 inline, so for motion in a PR make a GIF
first. Publishing the same run again replaces it.

### list

```sh
shots list --project heystol --limit 5
```

Without `--project`, every project.

### rm

```sh
shots rm heystol/20261002-134501-booking
```

Deletes the run's files and its index entry. Asks first unless `--yes`. The
CDN can keep serving a deleted file for a few minutes.

## Data layout

One public Blob store (`shots-media`, fra1). No database: the web UI reads
these.

```
<project>/index.json               IndexEntry[], newest first    max-age 60
<project>/<run-id>/manifest.json   Manifest                      max-age 60
<project>/<run-id>/<file>          png, mp4, gif                 max-age one year
```

The types are in `src/types.ts`, and only there: `Run` is the local
`run.json`, `Manifest` is the run plus `project`, `title` and a `url` on every
file, `IndexEntry` is one row of a project's index with the manifest's URL and
a cover image. A run id is `YYYYMMDD-HHMMSS-<scenario>` in UTC, so ids sort by
time.

Two things a reader should know:

- `index.json` is derived. The store's listing decides which runs exist, and
  every publish and rm rebuilds the index from it. A public store sits behind
  a CDN that serves an overwritten file's old copy for a minute or more, so the
  index a browser fetches can lag by that much. A server that holds the token
  can list `<project>/` folders instead and never lag.
- Projects are the store's top-level folders (`list({ mode: "folded" })`).
  There is no list of projects stored anywhere.

## Deployments are off

`vercel.json` turns Git deployments off, because there is no app to build yet.
Remove it when the web UI lands.

## Check

```sh
pnpm check   # tsc, oxlint, node --test
```
