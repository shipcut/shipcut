# Plan: faster recording, then a web interface

> **Delete this file once both parts are built.** It is a work order, not
> documentation. What stays true afterwards belongs in `README.md` and
> `AGENTS.md`.

Written 2026-10-02 from a read of the code at `08dc40f`. Nothing below is
measured yet. Part 1 starts with a measurement for that reason.

## Part 1. Recording

### Why it is slow

`run --video` gets about 18 distinct frames a second at 1080x1920. The box has
4 shared vCPUs and no GPU, and during a recording they are split between two
jobs:

1. Chromium rasterises the page in software and compresses each repaint to
   JPEG.
2. ffmpeg decompresses that JPEG, converts its colours with `zscale` and
   encodes x264, all while the page is still running.

Two things in `record()` (`src/run.ts`) make the second job heavier than it
has to be:

- `fill()` writes the frame on screen 30 times a second, so a page that stands
  still for two seconds costs 60 JPEG decodes and 60 colour conversions of the
  same picture.
- The encoder runs during the capture, at `nice 10` next to the browser it
  records, and for that reason is held to `-preset veryfast`.

`shots caption` then decodes and encodes the whole video a second time.

### Step 0. Measure first

Pick one scenario with real motion (`/tmp/shots-heystol/landing.ts` or a new
one in `examples/`) and record it three times with `--preset story --video`.
Keep, per run, the line `shots run` already prints:

```
shots: video 30 fps, <written> frames over <seconds>s from <captured> repaints, encoder backlog at most <n> MB
```

`captured / seconds` is the number to move. Also keep wall time of the whole
command, the size of `video.mp4`, and the peak memory line. Put the three
runs' numbers in the commit body of the change, before and after.

### Step 1. Capture to disk, encode after the browser closes

Replace the live ffmpeg pipe with a frame store.

- During the run, each `Page.screencastFrame` is acknowledged, decoded from
  base64 and written to `<out>/.frames/NNNNNN.jpg`. Its offset from `start` in
  milliseconds goes into an array. No ffmpeg process exists while the page
  runs.
- `stop()` records the end offset, then writes `<out>/.frames/list.ffconcat`:
  one `file` line and one `duration` line per frame, the duration being the
  gap to the next frame, the last one the gap to the end. The concat demuxer
  ignores the last `duration` unless the last `file` is listed once more, so
  list it twice.
- After `context.close()` and `browser.close()`, one ffmpeg run reads the list:

  ```
  ffmpeg -f concat -safe 0 -i list.ffconcat \
    -vf "crop=...,zscale=...,format=yuv420p,fps=30" \
    <MP4 args> <colour tags> -preset medium video.mp4
  ```

  `fps=30` sits after `zscale`, so each distinct frame is decoded and converted
  once and the duplicates are made from the converted frame.
- `.frames/` is removed when the encode succeeds and kept when it fails, with
  its path in the error.

What this changes for the rest of the code:

- `framesDue` and its tests go. `recordArgs` takes the list path instead of
  stdin and loses `-f image2pipe -framerate`.
- The check that the encoder kept every frame becomes a check on length: the
  video's duration is within one frame of the recorded seconds. Step offsets
  and caption timing depend on that.
- `Recorded` keeps `captured` and `seconds`; `written` and `backlog` go, and
  the summary line prints `captured / seconds` as repaints per second.
- The comment above `record()` is rewritten. It currently explains the pipe.

Costs to accept and state in the README:

- Disk. A JPEG at quality 92 and 1080x1920 is a few hundred KB, so a minute of
  motion is several hundred MB in `.frames/` until the encode finishes.
- Time. The command no longer ends when the scenario does. It ends after the
  encode.
- Memory. The encode still runs inside the 1500M `heavy` scope, but alone,
  after Chromium has exited.

Open question to settle by measuring: whether JPEG quality 92 is worth its
encode cost inside Chromium, or 85 looks the same after x264 at crf 20.

### Step 2. Captions in the same encode

The steps are known before the encode starts, so `shots run --video
--captions` can burn them in without a second generation.

- Add `--captions` and `--font FILE` to `run`.
- With `--captions`, the one ffmpeg run splits after `fps=30` into two
  outputs: `video.mp4` plain and `video-captioned.mp4` through
  `captionFilter`. One decode, one colour conversion, two encodes.
- `shots caption <run-dir>` stays for re-captioning a run that already exists.

### Step 3. Small ones, in the same change if they stay small

- `measure()` spawns `ffprobe` for every PNG. Read width and height from the
  IHDR chunk instead (bytes 16 to 23) and keep `ffprobe` for video.
- `shots clip` with only `--from` and `--to` can copy the stream instead of
  re-encoding. The cut then lands on a keyframe, so put it behind a `--copy`
  flag and leave the exact, re-encoded cut as the default.
- `publish` reads each file into memory. Pass `multipart: true` to `put` for
  files over 100 MB.

### Not doing

- **Go, Bun, another browser driver.** The time goes to software rasterising
  and to encoding, and neither moves with the language of the CLI.
- **Virtual time** (frames rendered on demand while the page's clock is
  held). It is the only way to an even 60 fps on this hardware, and it breaks
  Playwright's waits and real network requests. Revisit only if steps 1 and 2
  leave motion visibly uneven.
- **Lower default resolution.** `--scale 2` already gives 720x1280 at 2.25
  times fewer pixels. Mention it in the README as the flag for motion-heavy
  clips. The `story` preset stays at 1080x1920.

### Done when

- The three before and after runs are in the commit body and `captured /
  seconds` went up.
- A captioned story plays with captions on the right steps (check two
  offsets by eye against `run.json`).
- `pnpm check` passes, with `framesDue` tests replaced by tests of the concat
  list and the duration check.
- `README.md`, `AGENTS.md` and `skills/shots/SKILL.md` describe the new flags,
  the disk cost and the later end of the command.

## Part 2. Web interface

### What it is for

Seeing stored runs and their data without the CLI: projects, runs, shots,
videos, steps, the commit they came from. Renaming and deleting a run. Copying
the Markdown block and the file URLs.

### Stack

- Next.js 16 with the App Router, in `web/` of this repository. Tailwind and
  shadcn. Server components throughout, one client leaf for copy buttons and
  the delete confirmation.
- Deployed as the existing Vercel project `shots` with its root directory set
  to `web`. The Blob store `shots-media` is already linked to that project, so
  `BLOB_READ_WRITE_TOKEN` is there.
- The look: white on black, one sans, no card chrome, dense.

### Data

No database. Blob stays the only store, and the interface reads it the way
`shots list` does:

- **Projects** come from the folded listing of the store's root.
- **A project's runs** come from `currentIndex(project)`: the listing decides
  which runs exist, `index.json` supplies their entries. The listing API is
  not behind the CDN, so a run published seconds ago shows up.
- **A run** is its `manifest.json`. Images and videos are served straight from
  their public Blob URLs.
- **Rename** rewrites `manifest.json` and the index entry. **Delete** is
  `remove()`.

Caching: loaders use `"use cache"` with a tag per project and a one minute
lifetime. A server action that renames or deletes calls `updateTag` for its
project. A publish from the CLI is picked up when the minute runs out.

A database arrives only with data that no run carries: notes, tags, "posted to
X", search across thousands of runs. Then it is Neon with Drizzle as an index
over Blob, and the manifests stay where they are.

### Shared code

`src/store.ts` today mixes the Blob calls with the CLI's printing and the
delete prompt. Split it before the interface imports it:

- `src/store.ts` keeps the data functions and exports them: `listProjects`,
  `currentIndex`, `readManifest`, `publishRun`, `retitleRun`, `removeRun`.
  None of them prints or prompts.
- `src/cli.ts` (or a small `src/commands.ts`) does the printing, the prompt
  and the notes about caching.
- `web/` imports from `../src/store.ts` and `../src/types.ts`.

To check early, before building pages: that Next resolves the `.ts` extension
imports in `src/` from outside its root, and that Vercel includes `../src` in
the build with the root directory set to `web`. If either fails, make the
repository a pnpm workspace with `src/` as a package.

### Routes

| Route | Shows |
|---|---|
| `/` | Projects, each with its newest runs |
| `/[project]` | Every run: cover, title, scenario, date, file count |
| `/[project]/[run]` | Video player, shots, steps with offsets, viewport, commit and branch, file sizes, copy buttons, rename, delete |
| `/login` | One field for the secret |

### Access

The store is public and the interface can delete, so the interface is closed.

- One secret in the env var `SHOTS_SECRET`. `/login` compares it in constant
  time and sets an `HttpOnly`, `Secure`, `SameSite=Lax` cookie holding an HMAC
  of it.
- `proxy.ts` sends every request without a valid cookie to `/login`.
- Every server action checks the cookie itself and does not rely on the proxy.
- `ponytail:` one user, one secret. A real sign-in replaces it when a second
  person needs access.

### Order of work

1. Split `store.ts` as above. `pnpm check` still passes, `shots list` and
   `shots publish` behave as before.
2. Scaffold `web/`, prove the import of `../src` builds on Vercel with a page
   that lists projects.
3. Remove `vercel.json` (it turns deployments off), set the root directory to
   `web`, add `SHOTS_SECRET`.
4. Access: `/login`, the cookie, `proxy.ts`.
5. The three pages, read-only.
6. Rename and delete as server actions.
7. README section on the interface, then delete this file.

### Done when

- A run published from the CLI appears in the interface within a minute.
- Rename and delete from the interface show in `shots list` at once.
- Every route and every action answers a request without the cookie with the
  login page or a refusal.
- The index ceiling (one listing page, 1000 runs per project) is either
  lifted by following `cursor`, or still marked `ponytail:` in `store.ts`.
