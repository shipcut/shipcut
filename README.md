# shipcut

Screenshots and short videos of an app's real flows, recorded in headless
Chromium and published to Cloudflare R2 with a manifest. A changelog entry or a
PR pastes the links; later a web UI lists what was saved.

Scenarios live in the project they record. `shipcut` only records, clips and
publishes.

## Install

Node 24 runs the TypeScript as is, so there is no build.

```sh
git clone https://github.com/shipcut/shipcut && cd shipcut
pnpm install
ln -s "$PWD/bin/shipcut" ~/.local/bin/shipcut   # or any directory on your PATH
```

It needs `ffmpeg` built with librsvg (Ubuntu's is) and `ffprobe` on PATH, and
Playwright's Chromium
(`pnpm exec playwright install chromium` where it is missing).

Linux is where it is built and tested, and a CI runner is Linux. On macOS it
records, but `--frame-by-frame` does not run, because Chrome there cannot be
driven frame by frame. Windows is untested, and `bin/shipcut` is a bash
script.

Publishing needs a Cloudflare R2 bucket whose files are served publicly, and
five variables. Each comes from the environment or else from
`~/.config/shipcut/env`, a `KEY=value` file:

```sh
R2_ACCOUNT_ID=...          # the Cloudflare account that holds the bucket
R2_ACCESS_KEY_ID=...       # an R2 API token's S3 credentials,
R2_SECRET_ACCESS_KEY=...   # with Object Read & Write on the bucket
R2_BUCKET=...
R2_PUBLIC_URL=https://media.shipcut.dev   # where the bucket is served; every link starts here
```

`shipcut` signs its own requests to R2's S3 API, so there is no SDK to
install. If a variable is missing, `publish`, `list` and `rm` stop and name
it. They never print a value.

## Commands

### run

```sh
shipcut run flows/booking.ts --base http://localhost:3000 --video --pointer
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
offset are kept, and `shipcut caption` burns them into the video.
`step(title, { caption: false })` marks one that shows no caption, and
`{ zoom: false }` one whose clicks `polish --zoom` leaves alone. Type it with
`import type { Scenario } from "<this repo>/src/run.ts"` if you want the types.

| Flag | |
|---|---|
| `--base URL` | handed to the scenario, default `http://localhost:3000` |
| `--out DIR` | default `./out/<run-id>/` |
| `--preset` | `desktop` (default), `phone`, `post`, `story`; sizes below |
| `--viewport WxH` | CSS pixels, instead of a preset; no touch, scale 1 |
| `--scale N` | device pixel ratio; multiplies the shots and the video alike |
| `--video` | records the run as `video.mp4` (H.264, yuv420p, 30 fps, faststart) |
| `--frame-by-frame` | records every frame of the page's animations however slowly it paints, on a virtual clock; slower to record. Needs `--video`, excludes `--slow` |
| `--pointer` | glides a pointer to each element before the scenario acts on it and logs the path and the clicks in `run.json`; `shipcut polish` draws it. Needs `--video` |
| `--cursor` | the older pointer, drawn by the page itself from the mouse events; it jumps rather than glides. Excludes `--pointer` |
| `--slow MS` | pause between browser actions, so a video can be followed |
| `--storage-state FILE` | a Playwright storage state, to start signed in |
| `--mask` | blurs the text in email, phone and password fields and every email address and `+`-prefixed phone number on the page, in the video and the shots alike. A venue's public number is blurred too |
| `--mask-selector CSS` | also blurs what the selector matches, e.g. `input[name=name]`; repeatable, implies `--mask` |
| `--locale xx`, `--dark` | browser locale, dark colour scheme |

| Preset | CSS viewport | Scale | Shots and video | Layout |
|---|---|---|---|---|
| `desktop` | 1280x800 | 1 | 1280x800 | desktop |
| `phone` | 390x844 | 1 | 390x844 | phone: touch, mobile viewport |
| `post` | 360x450 | 3 | 1080x1350 | phone |
| `story` | 360x640 | 3 | 1080x1920 | phone |

A site picks its layout by CSS width, so `post` and `story` are a phone 360
wide, multiplied up to the 1080 a feed wants. For a desktop page in a tall
frame, say `--viewport 1080x1920`. `--preset phone --scale 3` is 1170x2532.

The run directory gets the files and a `run.json`. A scenario that throws
leaves `failed.png` and exits 1.

The video is the page's own repaints, taken from Chromium at device pixels.
During the run each repaint is stored as a JPEG under `<out>/.frames/`, and
nothing else runs beside the browser. When the scenario ends and the browser
has closed, one ffmpeg pass encodes them, each frame shown until the next one
arrived, so the rate is a constant 30 fps and a step's offset is its place in
the video. The command therefore ends after the encode, about as long again
as the recording for a page in constant motion, and `.frames/` holds a few
hundred KB per repaint until then: a minute of motion is several hundred MB.
The folder goes when the encode succeeds and stays, named in the error, when
it fails. A video whose length differs from the recording's by more than a
frame fails and says so.

It records the one page the scenario is given. A popup or a second tab is not
in it. Headless Chromium paints in software, so a 1080x1920 page that changes
on every frame comes out at about 26 repaints a second on a 4-vCPU machine
with no GPU, and a heavy page at 2 to 4; `shipcut measure` prints the number for a
run.

`--frame-by-frame` takes the page's time away from the wall clock. Chromium
draws a frame only when asked, and before each one the page's clock moves on
by exactly 1/30 s, standing still while a request is pending. Every frame of
every animation is in the video, the page's timers keep video time, and a
request looks instant. A response the page reads piece by piece as it streams
in takes about as long in the video as it took to arrive. After each frame
Chromium gets a second one that draws nothing, since without it no response
reaches the page. So `requestAnimationFrame` runs twice a frame, and an
animation that counts its callbacks instead of reading their time runs twice
as fast. Steps, shots, the pointer's events and the scenario's
`page.waitForTimeout` and typing delays all count video time, so two runs of
the same scenario come out the same length to within a frame. Recording takes
longer than the video: about 3 times at 1280x800 and 4 at 1080x1920 on that
machine. A
request that never ends, a stream or a long poll, would hold the clock, so
after 5 s the clock runs past pending requests for the rest of the run and
says which request it was. It needs Chromium's headless shell, which
Playwright runs by default, so Linux. A story run peaks near 700 MB.

### clip

```sh
shipcut clip out/20261002-134501-booking/video.mp4 --from 2 --to 9 --speed 1.5
shipcut clip out/20261002-134501-booking/video.mp4 --gif --width 480
```

Trims (`--from`, `--to` in seconds of the source), speeds up, scales, or makes
a palette GIF (12 fps, 640 wide unless `--width`). Writes `<name>-clip.mp4` or
`<name>.gif` next to the source unless `--out`. A result inside a run
directory is added to its `run.json`, so `publish` uploads it.

### caption

```sh
shipcut caption out/20261002-134501-booking
```

Burns each step's title into `video.mp4`, from the step's offset until the
next step, the last one to the end. Writes `video-captioned.mp4` in the run
directory unless `--out`, and adds it to `run.json`, so `publish` uploads it
beside the plain video.

The caption is white on an opaque black band across the frame, with a white
rule above and below so the band shows on a black page too. Text is a 22nd of
the frame's short side (49 px in a story). A title too long for one line
wraps, and a single word too long for a line shrinks the text. A wide frame
has the band on its bottom edge. A tall one has it end at 88% of the height,
because a story's own controls cover what is below.

The font is Inter Bold, which ships in `fonts/` with the labels' SemiBold, so
a caption looks the same on any machine; `--font FILE` picks another.

### polish

```sh
shipcut polish out/20261002-134501-booking
```

On a landscape video it draws the pointer with its labels, zooms on the
clicks and sets the result in a frame. A story gets the pointer, its labels
and the frame, a post or a phone the pointer and its labels: on a phone's
width a zoom crops the page at the sides. `--no-labels`, `--no-zoom` and `--no-frame` turn a part off, `--zoom` and
`--frame` turn one on. For a video to post:

```sh
shipcut run flows/booking.ts --scale 2 --video --frame-by-frame --pointer --mask
shipcut polish out/<run-id>
shipcut clip out/<run-id>/video-polished.mp4 --width 1920
```

The pointer is the one a `--pointer` run logged: an arrow on every
preset, and on each press a violet wave while the arrow gives for a few frames
and springs back. Writes
`video-polished.mp4` in the run directory unless `--out`, and adds it to
`run.json`. The page draws nothing during the run, so the pointer moves at the
video's 30 fps however slowly the page itself repaints. It can be drawn again
without a new run.

The labels put each step's title in a violet pill beside the pointer, below
and to the right of the arrow's tip. A label shows from its
step until the next one, 4 s at most, and fades in and out. It does not show
before the pointer's first move, and `step(title, { caption: false })` keeps
one out. A label flips to the pointer's left near the right edge and stays out
of a story's safe zones. A title longer than 32 characters is cut with an
ellipsis. The text is set in Inter SemiBold, which ships in `fonts/` under the
SIL Open Font License, so a label looks the same on any machine; a glyph Inter
lacks comes from the system's fonts.

The frame shrinks the result into a window with rounded corners and a soft
shadow on a still background, so the video keeps its size and the camera
moves inside the window. The window leaves a margin of 7% of the short side,
in a story too, where its top and bottom edges go under the feed's own
controls; kept clear of them, the window was a small card. The background is lavender into pale blue unless
`--background` gives one colour (`#0b0b0f`) or two for a diagonal gradient
(`#e4ddff,#c9dcff`); `--background` implies `--frame`. A framed desktop video
shows its page at 86%, so a recording meant for posting reads better at
`--scale 2`, brought back to a feed's size with `shipcut clip --width 1920`.
At 2560x1600 `polish` peaks near 1.35 GB of its 1.5 GB cap.

The zoom moves the camera. It closes in on a click by `--zoom-factor`
(1.5 unless given), finishing just before the click. Clicks less than about
3.4 s apart share one zoom, and the camera pans to a click that falls outside
the middle of the view. It pulls back 1.2 s after the last click of a run of
them. The view never leaves the frame, and the pointer is drawn first, so it
grows with the page. The source rectangle moves by fractions of a pixel, so a
slow zoom does not shake. It costs time: on a 1280x800 video the render takes
about as long as the video plays.

Under `--pointer` the pointer starts in the middle of the viewport. Before the
scenario clicks, taps, checks, hovers, fills, types or selects through a
locator or the page, the pointer travels to the element on a shallow arc. The
trip takes 250 ms for a short hop and 900 ms at most. `page.mouse.click` and
`dblclick` glide too, so a run takes that much longer per action. `run.json` gets
`events`: `clicks` and `moves`, each `[ms, x, y]` in milliseconds of the video
and CSS pixels.

### measure

```sh
shipcut measure out/20261002-134501-booking
```

Prints how the run's video came out, one fact a line: distinct frames a
second (ffmpeg's `mpdecimate` drops a frame that repeats the one before it),
the video's length and its drift against the seconds recorded, Chromium's
repaints a second, and the steps. The run's peak memory is on `run`'s own
stderr. This is the number the recorder is judged by, so a change to it keeps
a before and an after.

### publish

```sh
shipcut publish out/20261002-134501-booking --project heystol --title "Booking, new form"
```

Uploads the run to the bucket and prints Markdown on stdout: images embedded,
videos linked.
No Markdown host plays an outside mp4 inline, so for motion in a PR make a GIF
first. Publishing the same run again replaces it.

### list

```sh
shipcut list --project heystol --limit 5
```

Without `--project`, every project.

### rm

```sh
shipcut rm heystol/20261002-134501-booking
```

Deletes the run's files and its index entry. Asks first unless `--yes`.
Cloudflare's cache and any browser that already fetched a file can keep
serving it until it expires, which for a run's files is a year. When one must
be gone now, purge its URL in the Cloudflare dashboard.

## Data layout

One R2 bucket, served at `R2_PUBLIC_URL`. No database: the web UI reads
these.

```
<project>/index.json               IndexEntry[], newest first    max-age 60
<project>/<run-id>/manifest.json   Manifest                      max-age 60
<project>/<run-id>/<file>          png, mp4, gif                 max-age one year, immutable
```

The types are in `src/types.ts`, and only there: `Run` is the local
`run.json`, `Manifest` is the run plus `project`, `title` and a `url` on every
file, `IndexEntry` is one row of a project's index with the manifest's URL and
a cover image. A run id is `YYYYMMDD-HHMMSS-<scenario>` in UTC, so ids sort by
time.

Two things a reader should know:

- `index.json` is derived. The bucket's listing decides which runs exist, and
  every publish and rm rebuilds the index from it. Its public URL carries
  `max-age=60`, so the index a page fetches can lag by up to a minute. A
  server with the R2 credentials can list the
  `<project>/` folders through the S3 API instead and never lag.
- Projects are the bucket's top-level folders (ListObjectsV2 with
  `delimiter=/`). There is no list of projects stored anywhere.

## The landing

`web/` is shipcut.dev: one HTML page and the waitlist function
`web/api/waitlist.ts`, deployed by Vercel with `web` as the project root, so
a push to `main` goes live. The function needs `RESEND_API_KEY`,
`WAITLIST_FROM` and `WAITLIST_TO` in the project's environment.

## Check

```sh
pnpm check   # tsc, oxlint, node --test
```
