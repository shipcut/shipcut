# shots

A CLI that records screenshots and short videos of a web app in headless
Chromium and publishes them to Vercel Blob with a manifest. Other projects
keep the scenarios; this repo records, clips and publishes. `.claude/CLAUDE.md`
is a single `@` import of this file.

`README.md` is the user's view: the five commands and the data layout. Keep it
true when a flag or a stored shape changes.

## Layout

- `bin/shots` - the entry, symlinked into PATH. Runs `src/cli.ts` with Node.
- `src/cli.ts` - dispatch, and the re-exec under `heavy`.
- `src/lib.ts` - everything pure: run id, flag parsing, ffmpeg arguments, the
  index, the Markdown. This is what the tests cover.
- `src/run.ts` - the browser: scenario contract, cursor, video, `run.json`.
- `src/clip.ts` - the ffmpeg wrapper.
- `src/store.ts` - Blob: publish, list, rm, the token.
- `src/types.ts` - the stored shapes. Published manifests already have them,
  so add fields, do not rename or remove.
- `examples/counter.ts` - a scenario that serves its own page, for a run with
  no network.
- `skills/shots/SKILL.md` - how an agent in another project uses the CLI.

## Rules

- No build step. Node 24 strips types, so only erasable syntax: no `enum`, no
  parameter properties, no namespaces, and imports carry `.ts`. `tsconfig.json`
  enforces it.
- Runtime dependencies are `playwright` and `@vercel/blob`. Anything else needs
  a reason; ffmpeg is called as a program.
- Playwright stays on the minor whose Chromium is in `~/.cache/ms-playwright`.
  Bumping it means a browser download, so say so first.
- The token is read in `src/store.ts` and nowhere else, and is never printed.
- Reads of a rewritten Blob path are stale for a minute or more, even with a
  cache-busting query. Do not build on reading back what was just written; the
  listing API is the truth (`currentIndex` in `src/store.ts`).
- `vercel.json` keeps Git deployments off until there is an app. Do not push a
  branch expecting a preview.

## Heavy

The box is shared. Anything that starts a browser goes through `heavy`.
`shots run` does that itself, so call it plainly; do not wrap it in `heavy`
again and do not set `SHOTS_HEAVY` to skip it. Exit 75 means wait and retry.

## Check

`pnpm check` before handing over: `tsc --noEmit`, oxlint, `node --test`.
A change to `run.ts` or `clip.ts` also wants a real run:

```sh
bin/shots run examples/counter.ts --video --cursor --out out/check
ffprobe -v error -show_entries stream=codec_name:format=duration out/check/video.mp4
```

A publish test goes under project `selftest` and is removed with `shots rm`
afterwards.
