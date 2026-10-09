# shipcut

A CLI that records screenshots and short videos of a web app in headless
Chromium and publishes them to Cloudflare R2 with a manifest. Other projects
keep the scenarios; this repo records, clips and publishes. `.claude/CLAUDE.md`
is a single `@` import of this file.

One name everywhere: the command, the product, the repository
`shipcut/shipcut`, the checkout `~/projects/shipcut` and the Vercel project
`shipcut`. The old name `shots` is gone, and nothing reads it.

The store is the Cloudflare R2 bucket `shipcut-media`, served at
`https://media.shipcut.dev`. DNS for `shipcut.dev` is on Cloudflare; the
landing's records point at Vercel. The five `R2_*` keys are in
`~/.config/shipcut/env` on dev01, a plain file with mode 600, from a token
that can read and write that one bucket.

What the product is and is not: `PRODUCT.md`. The order of work: `ROADMAP.md`.
The current stage in detail: `docs/prd/<nn>-*.md`, the one `ROADMAP.md` names.

`README.md` is the user's view: the eight commands and the data layout. Keep it
true when a flag or a stored shape changes.

## Layout

- `bin/shipcut` - the entry, symlinked into PATH. Runs `src/cli.ts` with Node.
- `src/cli.ts` - dispatch, and the re-exec under `heavy`.
- `src/lib.ts` - everything pure: run id, presets, flag parsing, ffmpeg
  arguments, the caption timeline and layout, the index, the Markdown, the S3
  signature and the listing parser. This is what the tests cover.
- `src/run.ts` - the browser: scenario contract, the pointer's glide, the old cursor, the recorder,
  `run.json`.
- `src/clip.ts` - `clip`, `caption`, `polish` and `measure`, the ffmpeg wrappers.
- `src/store.ts` - R2: publish, list, rm, the credentials.
- `src/types.ts` - the stored shapes. Published manifests already have them,
  so add fields, do not rename or remove.
- `fonts/` - Inter SemiBold for the labels and Inter Bold for the captions,
  with their OFL licence, which must travel with them. `polish` points
  fontconfig at the folder; `caption` hands drawtext the file.
- `examples/counter.ts` - a scenario that serves its own page, for a run with
  no network.
- `skills/shipcut/SKILL.md` - how an agent in another project uses the CLI.

## Rules

- Work inside the current PRD. An idea for a later stage goes to "Заметки" in
  `ROADMAP.md`, not into code.
- A slice ends with a video one can watch and the numbers from `measure`.
- Existing commands and flags keep working. New behaviour starts behind a flag.
- Capture and polish are separate: capture writes raw frames and the event
  log, polish builds the video from them and can be rerun without a new run.
- Whatever moves over the page (the pointer, presses, labels, the zoom, the
  frame) is drawn by `polish` from the event log, never by the page: drawn by
  the page, it moves only as fast as the page paints.
- Hiding data is the capture's job, in the page, before a frame is taken. The
  raw `video.mp4` and the shots get published, so `polish` is too late.
- `polish` renders SVG through ffmpeg's librsvg, so ffmpeg must be built with
  it (`ffmpeg -decoders | grep librsvg`). Ubuntu's is.
- No build step. Node 24 strips types, so only erasable syntax: no `enum`, no
  parameter properties, no namespaces, and imports carry `.ts`. `tsconfig.json`
  enforces it.
- The one runtime dependency is `playwright`. `src/store.ts` talks to R2's S3
  API with `fetch` and a Signature Version 4 signer built on `node:crypto`,
  with no SDK. Anything else needs a reason; if Node, ffmpeg or Playwright does
  the job, there is no reason.
- Playwright stays on the minor whose Chromium is in `~/.cache/ms-playwright`.
  Bumping it means a browser download, so say so first.
- The video comes from Chromium's screencast over CDP, or under
  `--frame-by-frame` from `HeadlessExperimental.beginFrame` on a virtual clock.
  Either way the frames go to `<out>/.frames/` and one ffmpeg pass encodes
  them after the browser has closed, so the encoder never competes with the
  page. The frames are device-sized only because the browser starts with
  `--force-device-scale-factor`; the context's `deviceScaleFactor` alone gives
  CSS-sized frames. A frame that arrives after `stop()` is dropped, else the
  list and the recording's length disagree.
- Every time in a run comes from its `Clock`: steps, shots, the pointer's
  events and its waits. Never `Date.now()` or `setTimeout` for those; under
  `--frame-by-frame` the video's time is not the wall clock's.
- Only `src/store.ts` reads the R2 credentials, the five `R2_*` variables.
  Nothing prints a value, not even an error. An error names the missing
  variables, or R2's error code and the object key.
- Cloudflare and browsers cache a public URL for its `max-age`. A rewritten
  `index.json` or `manifest.json` can read stale for a minute, and a deleted
  run file for a year. Do not read back through the public URL something you
  just wrote and build on it. The S3 API's listing is the truth
  (`currentIndex` in `src/store.ts`).
- `web/` is the landing at shipcut.dev: the Vercel project `shipcut` has its
  root there, so a push to `main` deploys it and a branch gets a preview.
  Nothing outside `web/` is served.

## Words

Use these in code, commits and documents. Russian for prose, the code column
for identifiers.

| Термин | In code | Meaning |
|---|---|---|
| Сценарий | scenario | The TypeScript file that drives the page |
| Прогон | run | One execution of a scenario, with its output directory |
| Снимок | shot | A PNG saved by a `shot()` call |
| Кадр | frame | One picture of the video |
| Глава | step | A timestamped mark from a `step()` call |
| Титр | caption | A step's title burnt into the video |
| Пресет | preset | A named viewport size and scale |
| Журнал событий | events | Clicks, pointer moves and steps with offsets, in `run.json` |
| Оформление | polish | Building the final video from raw frames and the events |
| Манифест | manifest | The description of a published run in the store |

## Heavy

The box is shared. Anything that starts a browser or ffmpeg goes through
`heavy`. `shipcut run`, `clip`, `caption`, `polish` and `measure` do that themselves, so call them
plainly; do not wrap them in `heavy` again and do not set `SHIPCUT_HEAVY` to
skip it. Exit 75 means wait and retry.

## Check

`pnpm check` before handing over: `tsc --noEmit`, oxlint, `node --test`.
A change to `run.ts` or `clip.ts` also wants a real run:

```sh
bin/shipcut run examples/counter.ts --video --pointer --out out/check
bin/shipcut polish out/check
bin/shipcut caption out/check
ffprobe -v error -show_entries stream=codec_name,width,height,avg_frame_rate:format=duration out/check/video-captioned.mp4
```

Then pull a frame out and look at it. `ffprobe` does not see a soft or
mis-coloured picture.

A publish test goes under project `selftest` and is removed with `shipcut rm`
afterwards.
